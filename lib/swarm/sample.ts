import type { MissionInput, SensitiveDocument } from "./types";

export const TERM_SHEET = `NORTHWIND LABS — fictional term sheet notes. Not a real financing.

Post-money valuation is $48 million. The round size is $12 million.
Liquidation preference is 1x non-participating. The option pool is 12% post-money.
Investors receive pro-rata rights. The board becomes two founders and one investor.
Closing target is 21 days from signature.`;

export const CUSTOMER_MEMO = `NORTHWIND LABS — fictional customer memo. Synthetic, for the demo.

Helios Health accounts for 62% of trailing revenue. The master agreement renews in 70 days and is verbal only. Procurement has not countersigned.
Pinion Rail and Sable Clinic together are 19%. Churn last quarter was 4%.
A side letter promises a price hold through June.`;

export const COUNSEL_NOTE = `NORTHWIND LABS — fictional counsel note. Privileged only in the story.

Founder IP assignments are incomplete. A Berlin contractor never signed an assignment.
A former employer sent a demand letter. No case has been filed.
The option plan lacks a board consent for the latest grants.
Treat Helios Health, at 62% of trailing revenue, as a closing condition.
Recommend holding exclusivity until the assignments and the demand are papered.`;

export const SAFE_FOOTNOTE = `NORTHWIND LABS — fictional SAFE footnote. Invented.

A SAFE from last spring converts at a $18 million cap with a 20% discount.
It was not mentioned in the term sheet redline.`;

export const SAMPLE_GOAL =
  "Should Northwind Labs go to exclusivity? Report material terms and risks only. The packet is fictional.";

export const SAMPLE_DOCUMENTS: SensitiveDocument[] = [
  { id: "term-sheet", title: "Term sheet notes", body: TERM_SHEET },
  { id: "customer-memo", title: "Customer concentration memo", body: CUSTOMER_MEMO },
  { id: "counsel-note", title: "Counsel note", body: COUNSEL_NOTE },
];

export const SAFE_DOCUMENT: SensitiveDocument = {
  id: "safe-footnote",
  title: "SAFE footnote",
  body: SAFE_FOOTNOTE,
};

export function sampleMission(now = new Date()): MissionInput {
  return {
    goal: SAMPLE_GOAL,
    budgetUnits: 1000,
    deadlineIso: new Date(now.getTime() + 2 * 60 * 60 * 1000).toISOString(),
    documents: SAMPLE_DOCUMENTS.map((doc) => ({ ...doc })),
    scoutCount: 3,
    mode: "simulation",
  };
}
