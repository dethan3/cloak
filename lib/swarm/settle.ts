import { simRef } from "./accounts";
import type { AgentReport, SettlementEntry } from "./types";

export function allocateUnits(budget: number, weights: number[]): number[] {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  if (budget <= 0 || total <= 0) return weights.map(() => 0);
  const raw = weights.map((weight) => (budget * weight) / total);
  const floors = raw.map((value) => Math.floor(value));
  const left = budget - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, frac: value - Math.floor(value) }))
    .sort((a, b) => b.frac - a.frac || a.index - b.index);
  for (let i = 0; i < left; i += 1) floors[order[i % order.length].index] += 1;
  return floors;
}

export function settlementLog(
  missionId: string,
  agents: AgentReport[],
  coordinatorAccount: string,
  budget: number,
): { entries: SettlementEntry[]; unspentUnits: number } {
  const weights = agents.map((agent) => agent.weight);
  const units = allocateUnits(budget, weights);
  const entries: SettlementEntry[] = [
    {
      agentId: "coord",
      displayName: "Coordinator",
      subAccount: coordinatorAccount,
      units: 0,
      reason: "Coordinator opens the mission and does not read shards.",
      status: "simulated",
      txRef: simRef([missionId, coordinatorAccount, "0"]),
    },
  ];

  agents.forEach((agent, index) => {
    const share = units[index] ?? 0;
    entries.push({
      agentId: agent.agentId,
      displayName: agent.displayName,
      subAccount: agent.subAccount,
      units: share,
      reason:
        agent.status === "accepted"
          ? `Finding accepted. Weight ${agent.weight.toFixed(2)} from surviving claims.`
          : agent.status === "unassigned"
            ? "No shard was assigned, so the share is zero."
            : `Finding rejected. ${agent.rejectReason ?? "Share is zero."}`,
      status: "simulated",
      txRef: simRef([missionId, agent.subAccount, String(share)]),
    });
  });

  const paid = units.reduce((sum, value) => sum + value, 0);
  const unspentUnits = budget - paid;
  if (unspentUnits > 0) {
    entries.push({
      agentId: "unspent",
      displayName: "Unspent",
      subAccount: "—",
      units: unspentUnits,
      reason: "No accepted weight absorbed these units. They are not paid to the coordinator.",
      status: "simulated",
      txRef: simRef([missionId, "unspent", String(unspentUnits)]),
    });
  }

  return { entries, unspentUnits };
}

export async function describeParent(
  parent: string,
  rpcUrl: string,
  fetchImpl: typeof fetch,
): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3500);
  try {
    const response = await fetchImpl(rpcUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "cloak",
        method: "query",
        params: {
          request_type: "view_account",
          finality: "final",
          account_id: parent,
        },
      }),
      signal: controller.signal,
    });
    const json = (await response.json()) as {
      result?: { amount?: string };
      error?: { cause?: { name?: string } };
    };
    if (json.result && typeof json.result.amount === "string") {
      return `Parent ${parent} resolves on testnet. No signer key is configured, so transfers were not broadcast. Shares are recorded in this log.`;
    }
    const name = json.error?.cause?.name ?? "UNKNOWN";
    return `Parent ${parent} is not on testnet yet (${name}). Settlement is simulated. Fund the parent from the faucet before registering sub-accounts.`;
  } catch {
    return "Testnet RPC could not be reached. Settlement is simulated and the log is still complete.";
  } finally {
    clearTimeout(timer);
  }
}
