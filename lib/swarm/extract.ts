import type { Claim, ClaimKind, StrategyId } from "./types";

export type RawHit = {
  topic: string;
  text: string;
  confidence: number;
  kind: ClaimKind;
  material: boolean;
};

const HOME: Record<StrategyId, string[]> = {
  archivist: [
    "valuation",
    "round-size",
    "liquidation-preference",
    "option-pool",
    "board-composition",
    "closing-window",
    "pro-rata",
    "churn",
    "price-hold",
    "safe-terms",
    "amount-",
    "percent-",
  ],
  skeptic: [
    "customer-concentration",
    "verbal-agreement",
    "renewal-window",
    "demand-letter",
    "ip-assignment",
    "unsigned-contractor",
    "missing-consent",
    "safe-omission",
    "churn",
    "price-hold",
  ],
  counsel: [
    "liquidation-preference",
    "ip-assignment",
    "unsigned-contractor",
    "demand-letter",
    "missing-consent",
    "hold-exclusivity",
    "customer-concentration",
    "verbal-agreement",
    "safe-omission",
    "safe-terms",
    "board-composition",
  ],
  relay: ["closing-window", "renewal-window", "hold-exclusivity", "price-hold"],
};

function moneyToNumber(raw: string, unit?: string): number {
  const n = Number(raw.replace(/,/g, ""));
  const u = (unit ?? "").toLowerCase();
  if (u === "million" || u === "m") return n * 1_000_000;
  if (u === "billion" || u === "b") return n * 1_000_000_000;
  return n;
}

function moneyLabel(n: number): string {
  if (n >= 1_000_000 && n % 1_000_000 === 0) return `$${n / 1_000_000} million`;
  if (n >= 1_000_000_000 && n % 1_000_000_000 === 0) return `$${n / 1_000_000_000} billion`;
  return `$${n.toLocaleString("en-US")}`;
}

function isHome(strategy: StrategyId, topic: string): boolean {
  return HOME[strategy].some((entry) =>
    entry.endsWith("-") ? topic.startsWith(entry) : topic === entry,
  );
}

export function scanShard(body: string): RawHit[] {
  const hits: RawHit[] = [];
  const consumedMoney = new Set<number>();

  const add = (hit: RawHit) => {
    if (hits.some((existing) => existing.topic === hit.topic)) return;
    hits.push(hit);
  };

  const valuation = body.match(
    /valuation is \$\s?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|m|b)?/i,
  );
  if (valuation) {
    const n = moneyToNumber(valuation[1], valuation[2]);
    consumedMoney.add(n);
    add({
      topic: "valuation",
      text: `A stated valuation of ${moneyLabel(n)} appears in the assigned shard.`,
      confidence: 0.86,
      kind: "fact",
      material: false,
    });
  }

  const round = body.match(
    /round size is \$\s?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|m|b)?/i,
  );
  if (round) {
    const n = moneyToNumber(round[1], round[2]);
    consumedMoney.add(n);
    add({
      topic: "round-size",
      text: `The round size is given as ${moneyLabel(n)}.`,
      confidence: 0.84,
      kind: "fact",
      material: false,
    });
  }

  if (/1x non-participating/i.test(body)) {
    add({
      topic: "liquidation-preference",
      text: "Preferred stock is described as a 1x preference without participation.",
      confidence: 0.84,
      kind: "obligation",
      material: false,
    });
  }

  const pool = body.match(/option pool is (\d{1,2})\s*%/i);
  if (pool) {
    add({
      topic: "option-pool",
      text: `An option pool of ${pool[1]} percent is stated.`,
      confidence: 0.82,
      kind: "fact",
      material: false,
    });
  }

  if (/pro-rata/i.test(body)) {
    add({
      topic: "pro-rata",
      text: "Pro-rata rights are mentioned for investors.",
      confidence: 0.74,
      kind: "fact",
      material: false,
    });
  }

  if (/board becomes/i.test(body)) {
    add({
      topic: "board-composition",
      text: "Board composition is described as founder seats plus an investor seat.",
      confidence: 0.76,
      kind: "obligation",
      material: false,
    });
  }

  const closing = body.match(/closing target is (\d+)\s+days/i);
  if (closing) {
    add({
      topic: "closing-window",
      text: `A closing window of ${closing[1]} days is stated.`,
      confidence: 0.8,
      kind: "action",
      material: false,
    });
  }

  const concentration = body.match(/(\d{1,3})\s*% of trailing revenue/i);
  if (concentration) {
    add({
      topic: "customer-concentration",
      text: `A single customer is stated at ${concentration[1]} percent of revenue.`,
      confidence: 0.9,
      kind: "risk",
      material: true,
    });
  }

  if (/verbal only/i.test(body)) {
    add({
      topic: "verbal-agreement",
      text: "An agreement in this shard is described as verbal only.",
      confidence: 0.86,
      kind: "risk",
      material: true,
    });
  }

  const renewal = body.match(/renews in (\d+)\s+days/i);
  if (renewal) {
    add({
      topic: "renewal-window",
      text: `A renewal falls due in ${renewal[1]} days.`,
      confidence: 0.8,
      kind: "action",
      material: false,
    });
  }

  const churn = body.match(/churn[^.]{0,40}?(\d{1,3})\s*%/i);
  if (churn) {
    add({
      topic: "churn",
      text: `Recent churn is stated at ${churn[1]} percent.`,
      confidence: 0.72,
      kind: "fact",
      material: false,
    });
  }

  if (/price hold/i.test(body)) {
    add({
      topic: "price-hold",
      text: "A price-hold arrangement is mentioned.",
      confidence: 0.7,
      kind: "fact",
      material: false,
    });
  }

  if (/ip assignments are incomplete/i.test(body)) {
    add({
      topic: "ip-assignment",
      text: "Intellectual-property assignments are described as incomplete.",
      confidence: 0.88,
      kind: "obligation",
      material: true,
    });
  }

  if (/never signed/i.test(body)) {
    add({
      topic: "unsigned-contractor",
      text: "A contractor is described as never having signed an assignment.",
      confidence: 0.84,
      kind: "obligation",
      material: true,
    });
  }

  if (/demand letter/i.test(body)) {
    const filed = /no case has been filed/i.test(body);
    add({
      topic: "demand-letter",
      text: filed
        ? "A demand letter is mentioned, and no filed case is confirmed."
        : "A demand letter is mentioned in this shard.",
      confidence: 0.84,
      kind: "risk",
      material: true,
    });
  }

  if (/lacks a board consent/i.test(body)) {
    add({
      topic: "missing-consent",
      text: "Equity grants are described as missing board consent.",
      confidence: 0.8,
      kind: "obligation",
      material: true,
    });
  }

  if (/holding exclusivity/i.test(body)) {
    add({
      topic: "hold-exclusivity",
      text: "The scout reads a recommendation to wait before exclusivity.",
      confidence: 0.78,
      kind: "action",
      material: true,
    });
  }

  const cap = body.match(/\$\s?(\d[\d,]*)\s*(million|billion|m|b)?\s*cap/i);
  const discount = body.match(/(\d{1,2})\s*%\s*discount/i);
  if (cap && discount) {
    const n = moneyToNumber(cap[1], cap[2]);
    consumedMoney.add(n);
    add({
      topic: "safe-terms",
      text: `A SAFE is described with a ${moneyLabel(n)} cap and a ${discount[1]} percent discount.`,
      confidence: 0.82,
      kind: "fact",
      material: false,
    });
  }

  if (/not mentioned in the term sheet/i.test(body)) {
    add({
      topic: "safe-omission",
      text: "A prior instrument is flagged as missing from the term sheet.",
      confidence: 0.8,
      kind: "risk",
      material: true,
    });
  }

  if (hits.length === 0) {
    for (const match of body.matchAll(
      /\$\s?(\d[\d,]*(?:\.\d+)?)\s*(million|billion|m|b)?/gi,
    )) {
      const n = moneyToNumber(match[1], match[2]);
      if (consumedMoney.has(n)) continue;
      consumedMoney.add(n);
      add({
        topic: `amount-${n}`,
        text: `A figure of ${moneyLabel(n)} is stated.`,
        confidence: 0.7,
        kind: "fact",
        material: false,
      });
    }
  }

  return hits;
}

export function claimsForStrategy(hits: RawHit[], strategy: StrategyId): Claim[] {
  const claims: Claim[] = [];
  for (const hit of hits) {
    const home = isHome(strategy, hit.topic);
    if (!home && !hit.material) continue;
    let confidence = hit.confidence + (home ? 0.06 : -0.08);
    if (hit.material) confidence = Math.max(confidence, 0.64);
    confidence = Math.round(Math.max(0, Math.min(0.95, confidence)) * 100) / 100;
    if (confidence < 0.45) continue;
    claims.push({
      topic: hit.topic,
      text: hit.text,
      confidence,
      kind: hit.kind,
    });
  }
  return claims;
}

export function scriptedClaims(body: string, strategy: StrategyId): Claim[] {
  return claimsForStrategy(scanShard(body), strategy);
}
