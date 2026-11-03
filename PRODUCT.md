# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated, then constrained by the owner: pnpm is required for install, dev, and build (`pnpm install`, `pnpm dev`, `pnpm build`). The app is an installable PWA (web app manifest, icons, and a service worker with an offline shell). Implementation choice: Next.js (App Router) and TypeScript, because the owner asked for a practical TypeScript web app judges can run locally, with a simulation script beside the UI. No npm or yarn scripts.

Inferred where the brief left the framework open between Next and Vite; Next is the choice. Assumption: one repo, one app, no database, no auth.

## Users

Confirmed by the brief. Primary users are high-trust readers — founders, funds, and counsel — who need parallel research across confidential notes and cannot paste the whole set into a shared multi-agent log. Hackathon judges are the first operators: they run a fictional mission locally, with and without a NEAR AI key.

## Product Purpose

Cloak is a multi-agent research swarm. A coordinator splits sensitive documents into shards, each scout reads only its own shard, and a fold step publishes a summary built from accepted findings. Raw shard text does not appear in the public summary. Each scout maps to a NEAR testnet sub-account so the mission can show who earned which share of the budget.

Success for the MVP: a judge runs the sample mission in simulation with no API keys, sees agent status, a sealed public brief, and a settlement log; with `NEAR_AI_KEY` set, one real completion path runs and attestation is attempted.

## Positioning

Private shards plus a public fold, with per-agent budget attribution. This is a research swarm, not a sealed-bid group buy and not a spend-limit wallet. Neighboring products that auction GPU capacity or guard a wallet cannot truthfully claim this mechanism.

## Operating Context

Local demo. The operator pastes or loads 2–4 fictional snippets, sets a goal, a budget in units, and a deadline, then runs the swarm. Inference uses NEAR AI Cloud (`https://cloud-api.near.ai/v1`) when `NEAR_AI_KEY` is set; otherwise scouts follow scripted strategies. Settlement targets NEAR testnet sub-accounts and is simulated when no funded signer is available. Sample documents in the repo are fictional.

## Capabilities and Constraints

Confirmed:

- Mission: goal, budget units, deadline, 2–4 documents, default 3 scouts.
- One shard per scout. Extra scouts stay unassigned. Extra documents are grouped so each scout still receives exactly one shard.
- Findings are bullet claims with confidence. A fold merges accepted findings into a public summary. Raw shards are not part of that view.
- Simulation mode requires no LLM key. Scripted strategies are deterministic.
- Optional NEAR AI path and a best-effort attestation panel (client nonce; Verified or skipped-mock; graceful failure). Full Intel DCAP verification libraries are out of scope.
- Sub-account naming is documented. The UI records which agent earned which budget share. On-chain broadcast may be mocked.
- `RULES.md` states shard assignment, acceptance, budget shares, and the fold rule. MIT license. README includes do-X-see-Y steps.

Out of scope: sealed-bid group buying, an autonomous company, a spend-limit wallet, production custody, mainnet funds, real user PII.

Assumption: parent account placeholder is `cloak-swarm.testnet` until an operator sets `CLOAK_PARENT_ACCOUNT`. Assumption: budget units are an internal ledger, not NEAR tokens, unless a later signer path exists. Undecided: a production settlement contract. The MVP does not deploy one.

## Brand Commitments

Name: Cloak. Voice: direct, specific, no hype. The product talks about shards, scouts, the fold, and the seal. Sample material is labeled fictional.

## Evidence on Hand

The product spec is the hackathon brief. Sample missions are synthetic and must stay labeled that way. No customer logos, testimonials, or funded mainnet account are available; do not invent them.

## Product Principles

- A scout sees its shard and nothing else.
- The only text that leaves the room is the fold, after a leak scan.
- Simulation must be a complete demo, not a disabled button.
- Attribution is part of the result: who read, who was accepted, who was paid.
- If attestation or testnet settlement cannot be completed, say so and continue.
