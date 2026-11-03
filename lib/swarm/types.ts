export type InferenceMode = "simulation" | "near-ai";

export type StrategyId = "archivist" | "skeptic" | "counsel" | "relay";

export type ClaimKind = "fact" | "risk" | "obligation" | "action";

export type SensitiveDocument = {
  id: string;
  title: string;
  body: string;
};

export type MissionInput = {
  goal: string;
  budgetUnits: number;
  deadlineIso: string;
  documents: SensitiveDocument[];
  scoutCount: number;
  mode: InferenceMode;
  parentAccount?: string;
};

export type Claim = {
  topic: string;
  text: string;
  confidence: number;
  kind: ClaimKind;
};

export type Shard = {
  id: string;
  index: number;
  documentIds: string[];
  body: string;
};

export type AgentStatus = "unassigned" | "accepted" | "rejected";

export type InferenceLabel = "scripted" | "near-ai" | "scripted-fallback";

export type AgentReport = {
  agentId: string;
  displayName: string;
  letter: string;
  strategy: StrategyId;
  job: string;
  subAccount: string;
  shardId: string | null;
  shardLabel: string | null;
  documentCount: number;
  status: AgentStatus;
  rejectReason?: string;
  claims: Claim[];
  droppedForLeak: number;
  inference: InferenceLabel;
  fallbackNote?: string;
  weight: number;
  budgetUnits: number;
};

export type PublicClaim = {
  topic: string;
  text: string;
  confidence: number;
  support: number;
  agents: string[];
  keys: string[];
  label: "corroborated" | "single-source";
};

export type Fold = {
  headline: string;
  recommendation: string;
  summary: string;
  claims: PublicClaim[];
  dissent: string[];
  seal: {
    shardsSealed: number;
    overlapSpans: number;
    status: "sealed" | "redacted";
  };
};

export type SettlementEntry = {
  agentId: string;
  displayName: string;
  subAccount: string;
  units: number;
  reason: string;
  status: "simulated";
  txRef: string;
};

export type AttestationStatus = "verified" | "skipped-mock" | "unavailable" | "unverified";

export type AttestationPanel = {
  status: AttestationStatus;
  nonce?: string;
  detail: string;
  signingAddress?: string;
  requestNonceMatch?: boolean;
  quotePresent?: boolean;
  model?: string;
  fetchedAt?: string;
};

export type MissionResult = {
  missionId: string;
  parentAccount: string;
  coordinatorAccount: string;
  goal: string;
  budgetUnits: number;
  deadlineIso: string;
  deadlineNote: string;
  mode: InferenceMode;
  model?: string;
  createdAt: string;
  agents: AgentReport[];
  fold: Fold;
  settlement: SettlementEntry[];
  unspentUnits: number;
  attestation: AttestationPanel;
  rpcNote: string;
  publicPayloadNote: string;
};

export type ScoutProfile = {
  id: StrategyId;
  name: string;
  letter: string;
  job: string;
};

export const SCOUTS: readonly ScoutProfile[] = [
  {
    id: "archivist",
    name: "Archivist",
    letter: "A",
    job: "Pulls amounts, dates, and named figures.",
  },
  {
    id: "skeptic",
    name: "Skeptic",
    letter: "S",
    job: "Flags concentration, unsigned deals, and disputes.",
  },
  {
    id: "counsel",
    name: "Counsel",
    letter: "C",
    job: "Extracts obligations, gaps, and conditions.",
  },
  {
    id: "relay",
    name: "Relay",
    letter: "R",
    job: "Keeps deadlines and recommended actions.",
  },
] as const;

export const DEFAULT_PARENT = "cloak-swarm.testnet";
export const NEAR_AI_BASE = "https://cloud-api.near.ai/v1";
export const CONFIDENCE_FLOOR = 0.45;
export const LEAK_WINDOW = 24;
