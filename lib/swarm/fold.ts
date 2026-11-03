import { leaksInto, redactOverlaps } from "./leak";
import type { AgentReport, Claim, Fold, PublicClaim } from "./types";

const MATERIAL = new Set([
  "customer-concentration",
  "verbal-agreement",
  "ip-assignment",
  "unsigned-contractor",
  "demand-letter",
  "missing-consent",
  "safe-omission",
  "hold-exclusivity",
]);

export function sealClaims(
  claims: Claim[],
  shardBodies: string[],
): { kept: Claim[]; dropped: number } {
  const kept: Claim[] = [];
  let dropped = 0;
  for (const claim of claims) {
    if (leaksInto(claim.text, shardBodies)) dropped += 1;
    else kept.push(claim);
  }
  return { kept, dropped };
}

export function buildFold(agents: AgentReport[], shardBodies: string[]): Fold {
  const accepted = agents.filter((agent) => agent.status === "accepted");
  const byTopic = new Map<
    string,
    { text: string; confidence: number; agents: AgentReport[]; keys: string[] }
  >();

  for (const agent of accepted) {
    agent.claims.forEach((claim, index) => {
      const key = `${agent.letter}${index + 1}`;
      const existing = byTopic.get(claim.topic);
      if (!existing) {
        byTopic.set(claim.topic, {
          text: claim.text,
          confidence: claim.confidence,
          agents: [agent],
          keys: [key],
        });
        return;
      }
      existing.agents.push(agent);
      existing.keys.push(key);
      if (claim.confidence > existing.confidence) {
        existing.text = claim.text;
        existing.confidence = claim.confidence;
      }
    });
  }

  const claims: PublicClaim[] = [...byTopic.entries()]
    .map(([topic, group]) => ({
      topic,
      text: group.text,
      confidence: group.confidence,
      support: group.agents.length,
      agents: group.agents.map((agent) => agent.displayName),
      keys: group.keys,
      label:
        group.agents.length >= 2
          ? ("corroborated" as const)
          : ("single-source" as const),
    }))
    .sort((a, b) => {
      if (a.label !== b.label) return a.label === "corroborated" ? -1 : 1;
      return b.support - a.support || b.confidence - a.confidence;
    });

  const material = claims.some((claim) => MATERIAL.has(claim.topic));
  let headline: string;
  let recommendation: string;
  if (claims.length === 0) {
    headline = "No decision";
    recommendation =
      "No finding was accepted. The fold cannot support a decision.";
  } else if (material) {
    headline = "Hold exclusivity";
    recommendation =
      "Hold exclusivity. Accepted claims include a material risk or a papering gap.";
  } else {
    headline = "No material marker accepted";
    recommendation =
      "No material risk marker was accepted. Coverage is limited to the shards that were read.";
  }

  const corroborated = claims.filter((claim) => claim.label === "corroborated");
  const single = claims.filter((claim) => claim.label === "single-source");
  const line = (claim: PublicClaim) =>
    `- ${claim.text} (${claim.keys.join(" ")})`;

  const draft = [
    headline,
    "",
    recommendation,
    "",
    "Corroborated",
    corroborated.length ? corroborated.map(line).join("\n") : "None.",
    "",
    "Single-source",
    single.length ? single.map(line).join("\n") : "None.",
    "",
    `${shardBodies.length} shards stayed with their scouts. This brief uses accepted claims only.`,
  ].join("\n");

  const redacted = redactOverlaps(draft, shardBodies);
  const dissent = agents
    .filter((agent) => agent.status !== "accepted")
    .map((agent) =>
      agent.status === "unassigned"
        ? `${agent.displayName} was not assigned a shard and earned nothing.`
        : `${agent.displayName} was not accepted: ${agent.rejectReason ?? "finding rejected."}`,
    );

  return {
    headline,
    recommendation,
    summary: redacted.text,
    claims,
    dissent,
    seal: {
      shardsSealed: shardBodies.length,
      overlapSpans: redacted.count,
      status: redacted.count === 0 ? "sealed" : "redacted",
    },
  };
}
