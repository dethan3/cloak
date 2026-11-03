# Cloak

Cloak is a multi-agent research swarm for the NEAR Hackathon (AI Swarms, also agents). A coordinator seals sensitive notes into shards. Each scout reads only its own shard. A fold step publishes a summary built from accepted claims. Raw shard text does not leave in that summary. Every scout maps to a NEAR testnet sub-account, and the settlement log records who earned which share of the budget.

This is not a sealed-bid group buy, and it is not a spend-limit wallet.

The sample packet is fictional. Northwind Labs is not a real company.

## Problem

Founders, funds, and counsel often need several readers on a confidential packet. A normal multi-agent stack copies the whole packet into a shared log. Cloak splits the work, keeps each snippet with one scout, and shows judges a public brief plus an attribution log.

## How NEAR fits

- **Inference.** When `NEAR_AI_KEY` is set, scouts call the OpenAI-compatible NEAR AI Cloud gateway at `https://cloud-api.near.ai/v1`. Each request contains one shard.
- **Attestation.** Before those calls, Cloak generates a 32-byte nonce and requests `GET /v1/attestation/report`. The panel shows **Verified** when the report echoes that nonce and includes an Intel quote, **Unverified** or **Unavailable** when it does not, and **Skipped · mock** in simulation. Full Intel DCAP verification is intentionally not bundled.
- **Attribution.** Scout sub-accounts follow `{role}-{missionId}.{parent}` on testnet. The default parent is `cloak-swarm.testnet`. See [RULES.md](RULES.md). The UI records the budget share for each accepted finding. On-chain transfers are simulated (`sim:` receipts) when no funded signer is available. A best-effort `view_account` against testnet RPC says whether the parent exists. A missing parent does not fail the demo.

Budget units are an internal ledger in this MVP, not a mainnet transfer.

## Do this, see that

Install and run with pnpm. Node 22 is enough.

```bash
pnpm install
pnpm dev
```

Open [http://127.0.0.1:3847](http://127.0.0.1:3847) in a normal browser (Chrome or Firefox). The desk is a client app; use that browser rather than a headless checker.

1. The Northwind packet is already loaded. Leave inference on **Simulation**. Click **Run swarm**.
2. See three scouts move from waiting to accepted. Each row shows a different sub-account, for example `archivist-…….cloak-swarm.testnet`.
3. See the public brief. The recommendation is **Hold exclusivity**. Customer concentration is **Corroborated** (Skeptic and Counsel both saw a 62 percent figure, in different shards). The valuation is **Single-source** (only Archivist had the term sheet).
4. Open **What left the room**. The JSON has claims, accounts, and shares. It does not contain the snippet bodies. "Helios Health" and the Berlin contractor sentence are not in that payload.
5. See the settlement table. Scout units sum to 1000. Receipts start with `sim:`. The coordinator earns 0. Attestation reads **Skipped · mock**.
6. In a second terminal, run `pnpm sim`. The same fictional mission prints in the terminal and exits 0. `pnpm sim --offline` skips the testnet RPC lookup. `pnpm test` checks the seal, the one-shard rule, and the budget.

### NEAR AI, optional

```bash
cp .env.example .env.local
# set NEAR_AI_KEY, then restart
pnpm dev
```

Choose **NEAR AI** and run again. Scouts call `https://cloud-api.near.ai/v1/chat/completions`. Attestation leaves "Skipped · mock" and shows Verified, Unverified, or Unavailable. If a model call fails, that scout falls back to its script and the row says **Scripted fallback**. The fold rules do not change.

### Install the PWA

The app ships a web manifest, icons, and a service worker.

1. Load the site once in Chrome over localhost.
2. Use the install icon in the address bar, or the **Install** button when the browser offers a prompt.
3. The worker caches the offline page, icons, and fonts. Navigations stay network-first, so `pnpm dev` does not get stuck on a stale page.
4. Stop the server and reload. You should see Cloak's offline page instead of the browser's default error. Start `pnpm dev` again to run a mission. The API is not available offline.

`pnpm build` then `pnpm start` serves the production build on the same port.

## Sample packet

Fictional documents live in [sample-data/](sample-data/) and are loaded by the app:

- `term-sheet.md` — valuation, preference, pool, board, closing window
- `customer-memo.md` — concentration, verbal renewal
- `counsel-note.md` — IP gap, demand letter, the same concentration figure
- `safe-footnote.md` — optional fourth snippet, via **Add SAFE footnote**

## Rules

[RULES.md](RULES.md) is the swarm contract: shard assignment, when a finding is accepted, how budget shares are split, and the fold consensus rule.

## Scripts

| Command | What it does |
| --- | --- |
| `pnpm install` | Install dependencies |
| `pnpm dev` | Dev server on port 3847 |
| `pnpm build` | Production build |
| `pnpm start` | Serve the production build |
| `pnpm sim` | Run the sample mission in the terminal |
| `pnpm test` | Seal, sharding, and budget checks |
| `pnpm lint` | ESLint |

Package management is pnpm. Do not use npm or yarn for this repo.

## Fonts

UI text is Source Sans 3. Instrument numbers and sub-accounts are Barlow Condensed. Both are under the SIL Open Font License. The files in `public/fonts/` are the latin subsets used by the app.

## License

[MIT](LICENSE).
