import { resolveParent, createMissionId, subAccount } from "./accounts";
import { fetchAttestation } from "./attest";
import { scriptedClaims } from "./extract";
import { buildFold, sealClaims } from "./fold";
import { completeScout, resolveModel } from "./llm";
import { assignShards } from "./shard";
import { describeParent, settlementLog } from "./settle";
import {
  CONFIDENCE_FLOOR,
  NEAR_AI_BASE,
  SCOUTS,
  type AgentReport,
  type Claim,
  type InferenceLabel,
  type MissionInput,
  type MissionResult,
  type StrategyId,
} from "./types";

export type RunDeps = {
  now?: Date;
  missionId?: string;
  nearAiKey?: string;
  model?: string;
  baseUrl?: string;
  rpcUrl?: string;
  fetchImpl?: typeof fetch;
  skipNetwork?: boolean;
};

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function weightOf(claims: Claim[]): number {
  return Math.round(claims.reduce((sum, claim) => sum + claim.confidence, 0) * 100) / 100;
}

export async function runMission(input: MissionInput, deps: RunDeps = {}): Promise<MissionResult> {
  const now = deps.now ?? new Date();
  const missionId = createMissionId(deps.missionId);
  const parent = resolveParent(input.parentAccount);
  const coordinatorAccount = subAccount("coord", missionId, parent);
  const { shards, assignment } = assignShards(input.documents, input.scoutCount);
  const shardBodies = shards.map((shard) => shard.body);
  const shardById = new Map(shards.map((shard) => [shard.id, shard]));
  const key = deps.nearAiKey ?? process.env.NEAR_AI_KEY;
  const useModel = input.mode === "near-ai";
  if (useModel && !key) {
    throw new Error(
      "NEAR_AI_KEY is not set. Switch this run to simulation, or add the key and restart the server.",
    );
  }

  const baseUrl = deps.baseUrl ?? process.env.NEAR_AI_BASE_URL ?? NEAR_AI_BASE;
  let model: string | undefined;
  if (useModel && key && !deps.skipNetwork) {
    model = await resolveModel({
      baseUrl,
      apiKey: key,
      preferred: deps.model ?? process.env.NEAR_AI_MODEL,
      fetchImpl: deps.fetchImpl,
    });
  }
  const attestation = await fetchAttestation({
    apiKey: useModel ? key : undefined,
    model,
    skip: !useModel || deps.skipNetwork,
    baseUrl,
    fetchImpl: deps.fetchImpl,
  });

  const profiles = SCOUTS.slice(0, input.scoutCount);
  const agents: AgentReport[] = [];

  for (let index = 0; index < profiles.length; index += 1) {
    const profile = profiles[index];
    const shardId = assignment[index];
    const shard = shardId ? shardById.get(shardId) : undefined;
    const account = subAccount(profile.id, missionId, parent);

    if (!shard) {
      agents.push({
        agentId: profile.id,
        displayName: profile.name,
        letter: profile.letter,
        strategy: profile.id,
        job: profile.job,
        subAccount: account,
        shardId: null,
        shardLabel: null,
        documentCount: 0,
        status: "unassigned",
        rejectReason: "No shard assigned. Extra scouts do not receive a copy.",
        claims: [],
        droppedForLeak: 0,
        inference: "scripted",
        weight: 0,
        budgetUnits: 0,
      });
      continue;
    }

    const scripted = scriptedClaims(shard.body, profile.id as StrategyId);
    let claims = scripted;
    let inference: InferenceLabel = "scripted";
    let fallbackNote: string | undefined;

    if (useModel && key && !deps.skipNetwork) {
      try {
        const modeled = await completeScout({
          baseUrl,
          apiKey: key,
          model: model ?? "zai-org/GLM-5.1-FP8",
          strategy: profile.id,
          goal: input.goal,
          shardBody: shard.body,
          fetchImpl: deps.fetchImpl,
        });
        const sealedModel = sealClaims(modeled, shardBodies);
        const surviving = sealedModel.kept.filter((claim) => claim.confidence >= CONFIDENCE_FLOOR);
        if (surviving.length === 0) {
          fallbackNote = "The model returned no claims that cleared the seal and confidence bar. Scripted strategy was used.";
          inference = "scripted-fallback";
          claims = scripted;
        } else {
          claims = surviving;
          inference = "near-ai";
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "model call failed";
        fallbackNote = `Model call failed (${message.slice(0, 160)}). Scripted strategy was used.`;
        inference = "scripted-fallback";
        claims = scripted;
      }
    }

    const sealed = sealClaims(claims, shardBodies);
    const avg = mean(sealed.kept.map((claim) => claim.confidence));
    const accepted = sealed.kept.length > 0 && avg >= CONFIDENCE_FLOOR;
    let rejectReason: string | undefined;
    if (!accepted) {
      rejectReason =
        sealed.dropped > 0 && sealed.kept.length === 0
          ? "Every claim overlapped sealed shard text and was dropped."
          : `Mean confidence ${avg.toFixed(2)} is below ${CONFIDENCE_FLOOR.toFixed(2)}, or no claim survived.`;
    }

    agents.push({
      agentId: profile.id,
      displayName: profile.name,
      letter: profile.letter,
      strategy: profile.id,
      job: profile.job,
      subAccount: account,
      shardId: shard.id,
      shardLabel: `Shard ${shard.index + 1}`,
      documentCount: shard.documentIds.length,
      status: accepted ? "accepted" : "rejected",
      rejectReason,
      claims: sealed.kept,
      droppedForLeak: sealed.dropped,
      inference,
      fallbackNote,
      weight: accepted ? weightOf(sealed.kept) : 0,
      budgetUnits: 0,
    });
  }

  const fold = buildFold(agents, shardBodies);
  const { entries, unspentUnits } = settlementLog(
    missionId,
    agents,
    coordinatorAccount,
    input.budgetUnits,
  );
  for (const agent of agents) {
    const entry = entries.find((row) => row.agentId === agent.agentId);
    agent.budgetUnits = entry?.units ?? 0;
  }

  const late = Date.parse(input.deadlineIso) < now.getTime();
  const deadlineNote = late
    ? "The deadline had already passed when the mission ran. Shares were still recorded. This MVP does not slash late work."
    : "The mission finished inside the deadline.";

  const rpcUrl = deps.rpcUrl ?? process.env.NEAR_RPC_URL ?? "https://rpc.testnet.near.org";
  const rpcNote = deps.skipNetwork
    ? "Network checks were skipped. Settlement is simulated."
    : await describeParent(parent, rpcUrl, deps.fetchImpl ?? fetch);

  return {
    missionId,
    parentAccount: parent,
    coordinatorAccount,
    goal: input.goal,
    budgetUnits: input.budgetUnits,
    deadlineIso: input.deadlineIso,
    deadlineNote,
    mode: input.mode,
    model,
    createdAt: now.toISOString(),
    agents,
    fold,
    settlement: entries,
    unspentUnits,
    attestation,
    rpcNote,
    publicPayloadNote:
      "This payload is the public fold. Document bodies and shard text are not included.",
  };
}
