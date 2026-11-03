import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { isValidNearAccount, subAccount } from "./accounts";
import { scriptedClaims } from "./extract";
import { sealClaims } from "./fold";
import { leaksInto } from "./leak";
import { runMission } from "./run";
import {
  COUNSEL_NOTE,
  CUSTOMER_MEMO,
  SAFE_DOCUMENT,
  SAMPLE_DOCUMENTS,
  TERM_SHEET,
  sampleMission,
} from "./sample";
import { assignShards } from "./shard";
import { allocateUnits } from "./settle";

const NOW = new Date("2026-11-03T15:00:00.000Z");

test("sample files match the packet the app loads", () => {
  const root = new URL("../../sample-data/", import.meta.url);
  const read = (name: string) => readFileSync(new URL(name, root), "utf8").trimEnd();
  assert.equal(read("term-sheet.md"), TERM_SHEET.trimEnd());
  assert.equal(read("customer-memo.md"), CUSTOMER_MEMO.trimEnd());
  assert.equal(read("counsel-note.md"), COUNSEL_NOTE.trimEnd());
});

test("each scout receives one shard and documents are not copied across scouts", () => {
  const three = assignShards(SAMPLE_DOCUMENTS, 3);
  assert.deepEqual(
    three.assignment.map((id) => three.shards.find((shard) => shard.id === id)?.documentIds),
    [["term-sheet"], ["customer-memo"], ["counsel-note"]],
  );

  const extra = assignShards(SAMPLE_DOCUMENTS, 4);
  assert.equal(extra.assignment[3], null);

  const packed = assignShards([...SAMPLE_DOCUMENTS, SAFE_DOCUMENT], 3);
  assert.deepEqual(packed.shards[0].documentIds, ["term-sheet", "safe-footnote"]);
  assert.deepEqual(packed.shards[1].documentIds, ["customer-memo"]);
  const seen = new Set<string>();
  for (const shard of packed.shards) {
    for (const id of shard.documentIds) {
      assert.equal(seen.has(id), false);
      seen.add(id);
    }
  }
});

test("a verbatim claim is dropped and a paraphrase can stay", () => {
  const shard = "The secret phrase is indigo walrus cathedral at dawn today.";
  assert.equal(leaksInto(shard, [shard]), true);
  const sealed = sealClaims(
    [
      { topic: "other", text: shard, confidence: 0.9, kind: "fact" },
      {
        topic: "other",
        text: "The shard names a coded phrase and a time of day.",
        confidence: 0.7,
        kind: "fact",
      },
    ],
    [shard],
  );
  assert.equal(sealed.dropped, 1);
  assert.equal(sealed.kept.length, 1);
});

test("Northwind simulation seals the fold and pays the budget", async () => {
  const result = await runMission(sampleMission(NOW), {
    missionId: "n0rth1",
    now: NOW,
    skipNetwork: true,
  });

  assert.equal(result.mode, "simulation");
  assert.equal(result.attestation.status, "skipped-mock");
  assert.equal(result.coordinatorAccount, "coord-n0rth1.cloak-swarm.testnet");
  assert.equal(result.agents[0].subAccount, "archivist-n0rth1.cloak-swarm.testnet");
  assert.equal(result.agents[1].subAccount, "skeptic-n0rth1.cloak-swarm.testnet");
  assert.equal(result.agents[2].subAccount, "counsel-n0rth1.cloak-swarm.testnet");
  for (const account of [
    result.coordinatorAccount,
    ...result.agents.map((agent) => agent.subAccount),
  ]) {
    assert.equal(isValidNearAccount(account), true);
  }

  assert.equal(result.agents.every((agent) => agent.status === "accepted"), true);
  assert.equal(result.fold.seal.status, "sealed");
  assert.equal(result.fold.seal.overlapSpans, 0);
  assert.equal(result.fold.headline, "Hold exclusivity");

  const concentration = result.fold.claims.find((claim) => claim.topic === "customer-concentration");
  assert.ok(concentration);
  assert.equal(concentration.label, "corroborated");
  assert.deepEqual(concentration.agents.slice().sort(), ["Counsel", "Skeptic"]);

  const valuation = result.fold.claims.find((claim) => claim.topic === "valuation");
  assert.ok(valuation);
  assert.equal(valuation.label, "single-source");
  assert.deepEqual(valuation.agents, ["Archivist"]);

  const paid = result.agents.reduce((sum, agent) => sum + agent.budgetUnits, 0);
  assert.equal(paid, 1000);
  assert.equal(result.unspentUnits, 0);
  assert.equal(
    result.settlement.filter((row) => row.agentId !== "coord").reduce((sum, row) => sum + row.units, 0),
    1000,
  );

  const payload = JSON.stringify(result);
  for (const body of [TERM_SHEET, CUSTOMER_MEMO, COUNSEL_NOTE]) {
    const norm = body.toLowerCase().replace(/\s+/g, " ");
    for (let i = 0; i <= norm.length - 24; i += 1) {
      assert.equal(payload.toLowerCase().includes(norm.slice(i, i + 24)), false);
    }
  }
  assert.equal(payload.includes("Helios Health"), false);
  assert.equal(payload.includes("Berlin contractor"), false);
});

test("an unassigned scout earns zero", async () => {
  const input = sampleMission(NOW);
  input.documents = input.documents.slice(0, 2);
  input.scoutCount = 3;
  const result = await runMission(input, { missionId: "aabbcc", now: NOW, skipNetwork: true });
  const idle = result.agents.find((agent) => agent.status === "unassigned");
  assert.ok(idle);
  assert.equal(idle.budgetUnits, 0);
  assert.equal(idle.claims.length, 0);
  const paid = result.agents.reduce((sum, agent) => sum + agent.budgetUnits, 0);
  assert.equal(paid + result.unspentUnits, input.budgetUnits);
});

test("budget leftovers follow the largest remainder", () => {
  assert.deepEqual(allocateUnits(100, [1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(allocateUnits(10, [0, 0, 0]), [0, 0, 0]);
});

test("scripted scouts do not all emit the same topics from one shard", () => {
  const archivist = scriptedClaims(TERM_SHEET, "archivist").map((claim) => claim.topic);
  const skeptic = scriptedClaims(TERM_SHEET, "skeptic").map((claim) => claim.topic);
  assert.ok(archivist.includes("valuation"));
  assert.equal(skeptic.includes("valuation"), false);
});

test("sub-account helper rejects a broken parent", () => {
  assert.throws(() => subAccount("archivist", "abc123", "NOT VALID"));
});
