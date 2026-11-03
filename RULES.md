# Cloak swarm rules

These are the rules the code enforces. If the UI and this file disagree, treat that as a bug.

## Participants

- One coordinator per mission. It does not read shard text and it earns 0.
- N scouts, default 3, allowed range 2–4. Strategies, in order: Archivist, Skeptic, Counsel, Relay.
- Parent account: `CLOAK_PARENT_ACCOUNT`, or `cloak-swarm.testnet` when unset.

## Sub-account names

NEAR testnet account ids: lowercase, 2–64 characters, matching the NEAR account-id grammar.

```
{role}-{missionId}.{parent}
```

- `role` is `archivist`, `skeptic`, `counsel`, `relay`, or `coord`.
- `missionId` is 6 lowercase letters or digits, issued when the mission is filed.
- The full id, including the parent, must be a valid NEAR account id.

Example for mission `n0rth1` under the default parent:

- `coord-n0rth1.cloak-swarm.testnet`
- `archivist-n0rth1.cloak-swarm.testnet`
- `skeptic-n0rth1.cloak-swarm.testnet`
- `counsel-n0rth1.cloak-swarm.testnet`

Creating those accounts on-chain needs a funded parent and the testnet faucet. This MVP does not depend on that. It always writes a settlement log. Receipts use a `sim:` reference. If the RPC cannot see the parent, the log says so and the run still finishes.

## Shard assignment

1. A mission has D documents (2–4) and N scouts.
2. Documents stay in the order the operator submitted.
3. If D is less than or equal to N, shard i is document i. Scouts at index i ≥ D are unassigned and receive no text.
4. If D is greater than N, document i is appended to shard `i mod N`. Each scout still receives exactly one shard. A shard may contain more than one document. Those documents are joined only inside that scout's private input.
5. A scout's script, or its model prompt, receives the goal and that shard only.
6. The fold receives accepted claims only. It does not receive shard bodies.

## What a scout returns

A finding is a list of claims. Each claim has a topic key, a paraphrased sentence, a confidence from 0 to 1, and a kind: `fact`, `risk`, `obligation`, or `action`.

Scripted strategies (simulation, and the fallback if a model call fails):

- Archivist keeps quantitative facts.
- Skeptic keeps risk markers, renewals, churn, and price-hold language.
- Counsel keeps obligations, conditions, and legal gaps.
- Relay keeps deadlines and recommended next actions.
- A material marker is kept by whichever scout holds the shard, even when it is not that strategy's home topic. Non-material claims outside the strategy are omitted.

Material topics: `customer-concentration`, `verbal-agreement`, `ip-assignment`, `unsigned-contractor`, `demand-letter`, `missing-consent`, `safe-omission`, `hold-exclusivity`.

Claims are paraphrases. They are not excerpts.

## Seal check

The coordinator drops a claim if any 24-character window of its text, lowercased with whitespace collapsed, appears in any shard body. Dropped claims never enter the fold. The same scan runs on the public summary. Overlapping windows in the summary are replaced with `[sealed]` and counted.

## When a finding is accepted

A scout is accepted only if all of the following hold:

1. The scout was assigned a shard.
2. At least one claim survives the seal check.
3. The mean confidence of the surviving claims is at least 0.45.

Otherwise the finding is rejected, the reason is recorded, and the budget share is 0. Unassigned is a separate status and also earns 0.

## Fold consensus

The fold reads accepted claims and nothing else.

- A topic key shared by two or more accepted scouts is **corroborated**.
- A topic from exactly one accepted scout is **single-source**.
- The public summary is those paraphrases, with keys back to the scouts (`A1`, `S2`, `C1`), plus a recommendation:
  - If any accepted topic is a material marker, the recommendation is to hold exclusivity.
  - If there are accepted claims and no material marker, the recommendation says coverage is limited to the shards that were read.
  - If nothing was accepted, the recommendation says the fold cannot support a decision.
- Raw shard text is not a sentence in the summary. Source titles are omitted.

## Budget shares

- The mission budget is a positive integer number of units. In this MVP the units are an internal ledger, not a NEAR transfer.
- The weight of an accepted scout is the sum of its surviving claim confidences.
- Rejected and unassigned scouts have weight 0.
- Units are `floor(budget * weight / totalWeight)`. Leftover units go one at a time to the largest fractional remainders. Ties break toward the earlier scout.
- Accepted units sum to the budget. If every weight is 0, every scout gets 0 and the remainder is recorded as unspent. It is not paid to the coordinator.

## Deadline

The deadline is stored on the mission. If it is already past at run time, shares are still computed and the log notes that the deadline passed. This MVP does not slash shares.

## Attestation

If the run is simulation, or `NEAR_AI_KEY` is unset, the panel is **skipped-mock** and no attestation request is sent.

If the key is set and the run uses NEAR AI, Cloak resolves a model id, generates a 32-byte nonce (64 hex characters), and requests:

`GET https://cloud-api.near.ai/v1/attestation/report?signing_algo=ecdsa&nonce=…`

When the model id is known it also sends `model`, `provider=near`, and the header `x-no-aliasing: true`.

- **Verified** (best effort): the response echoes the same nonce and includes an Intel quote. Full DCAP / TCB verification is not bundled.
- **Unverified**: a response arrived but the nonce or quote check failed.
- **Unavailable**: the request failed. The mission still runs.

## Inference

- Simulation uses scripted strategies only. No outbound model call.
- NEAR AI uses `POST https://cloud-api.near.ai/v1/chat/completions` (OpenAI-compatible). Each scout request contains only that scout's shard. If a scout call fails, or returns no claim that survives the seal and the confidence bar, that scout falls back to its scripted strategy and the report says `scripted-fallback`.

## Public payload

The HTTP response and `pnpm sim` stdout include the goal, claims, fold, accounts, and settlement. They do not include document bodies.
