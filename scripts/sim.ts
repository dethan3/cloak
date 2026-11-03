import { leaksInto } from "../lib/swarm/leak";
import { runMission } from "../lib/swarm/run";
import { SAMPLE_DOCUMENTS, sampleMission } from "../lib/swarm/sample";

async function main() {
const offline = process.argv.includes("--offline");
const now = new Date("2026-11-03T15:00:00.000Z");
const result = await runMission(sampleMission(now), {
  missionId: "n0rth1",
  now,
  skipNetwork: offline,
});

const bodies = SAMPLE_DOCUMENTS.map((doc) => doc.body);
const payload = JSON.stringify({
  fold: result.fold,
  agents: result.agents,
  settlement: result.settlement,
});
let leaked = false;
for (const body of bodies) {
  if (leaksInto(body, [payload]) || leaksInto(payload, [body])) {
    leaked = true;
  }
  const norm = body.toLowerCase().replace(/\s+/g, " ");
  for (let i = 0; i <= norm.length - 24; i += 1) {
    if (payload.toLowerCase().includes(norm.slice(i, i + 24))) leaked = true;
  }
}

console.log("Cloak simulation");
console.log(`mission ${result.missionId}  mode ${result.mode}  parent ${result.parentAccount}`);
console.log(`coordinator ${result.coordinatorAccount}`);
console.log("");
console.log("Scouts");
for (const agent of result.agents) {
  console.log(
    `- ${agent.displayName}  ${agent.status}  ${agent.budgetUnits} units  ${agent.subAccount}`,
  );
  for (const claim of agent.claims) {
    console.log(`    ${claim.topic}  ${claim.confidence.toFixed(2)}  ${claim.text}`);
  }
}
console.log("");
console.log("Public brief");
console.log(result.fold.summary);
console.log("");
console.log(`Seal  ${result.fold.seal.status}  overlaps ${result.fold.seal.overlapSpans}  shards ${result.fold.seal.shardsSealed}`);
console.log("");
console.log("Settlement");
for (const row of result.settlement) {
  console.log(`- ${row.displayName}  ${row.units}  ${row.txRef}  ${row.subAccount}`);
  console.log(`    ${row.reason}`);
}
console.log(result.rpcNote);
console.log(result.deadlineNote);
console.log(`Attestation  ${result.attestation.status}`);
console.log(result.attestation.detail);

if (result.fold.seal.overlapSpans > 0 || leaked) {
  console.error("Seal check failed: public output overlapped a shard.");
  process.exit(1);
}
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : "Simulation failed.";
  console.error(message);
  process.exit(1);
});
