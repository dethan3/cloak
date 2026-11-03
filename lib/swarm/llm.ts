import { NEAR_AI_BASE, type Claim, type ClaimKind, type StrategyId } from "./types";
import { SCOUTS } from "./types";

const TOPICS = [
  "valuation",
  "round-size",
  "liquidation-preference",
  "option-pool",
  "board-composition",
  "closing-window",
  "pro-rata",
  "customer-concentration",
  "verbal-agreement",
  "renewal-window",
  "churn",
  "price-hold",
  "ip-assignment",
  "unsigned-contractor",
  "demand-letter",
  "missing-consent",
  "hold-exclusivity",
  "safe-terms",
  "safe-omission",
  "other",
];

const KINDS = new Set<ClaimKind>(["fact", "risk", "obligation", "action"]);

const PREFERRED_MODELS = [
  "zai-org/GLM-5.1-FP8",
  "z-ai/glm-5.2",
  "z-ai/glm-5.3-flash",
];

export function scoutSystemPrompt(strategy: StrategyId): string {
  const profile = SCOUTS.find((scout) => scout.id === strategy);
  return [
    `You are ${profile?.name ?? strategy}, one scout in the Cloak research swarm.`,
    profile?.job ?? "",
    "You can see only the single shard in the user message. Do not invent other documents.",
    'Return JSON only: {"claims":[{"topic":"string","text":"string","confidence":0.8,"kind":"fact"}]}',
    `topic must be one of: ${TOPICS.join(", ")}.`,
    "kind is fact, risk, obligation, or action.",
    "Write 2 to 5 paraphrased claims. Do not copy six or more consecutive words from the shard.",
    "confidence is a number from 0 to 1.",
  ].join("\n");
}

export function scoutUserPrompt(goal: string, shardBody: string): string {
  return `Goal:\n${goal}\n\nShard:\n${shardBody}`;
}

function parseJsonObject(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("Model response had no JSON object.");
  return JSON.parse(raw.slice(start, end + 1));
}

export function claimsFromModel(text: string): Claim[] {
  const parsed = parseJsonObject(text) as { claims?: unknown };
  if (!Array.isArray(parsed.claims)) throw new Error("Model JSON had no claims array.");
  const claims: Claim[] = [];
  for (const entry of parsed.claims) {
    if (!entry || typeof entry !== "object") continue;
    const row = entry as Record<string, unknown>;
    const topic = typeof row.topic === "string" ? row.topic.trim() : "";
    const claimText = typeof row.text === "string" ? row.text.trim() : "";
    const confidence = typeof row.confidence === "number" ? row.confidence : Number(row.confidence);
    const kind = typeof row.kind === "string" ? row.kind : "fact";
    if (!topic || !claimText || !Number.isFinite(confidence)) continue;
    claims.push({
      topic: topic.slice(0, 80),
      text: claimText.slice(0, 400),
      confidence: Math.max(0, Math.min(1, confidence)),
      kind: KINDS.has(kind as ClaimKind) ? (kind as ClaimKind) : "fact",
    });
  }
  return claims.slice(0, 6);
}

async function postChat(options: {
  baseUrl: string;
  apiKey: string;
  model: string;
  system: string;
  user: string;
  fetchImpl: typeof fetch;
  jsonMode: boolean;
}): Promise<string> {
  const response = await options.fetchImpl(`${options.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${options.apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: options.model,
      temperature: 0.2,
      messages: [
        { role: "system", content: options.system },
        { role: "user", content: options.user },
      ],
      ...(options.jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 180);
    const error = new Error(`NEAR AI HTTP ${response.status}: ${detail}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }
  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function completeScout(options: {
  baseUrl?: string;
  apiKey: string;
  model: string;
  strategy: StrategyId;
  goal: string;
  shardBody: string;
  fetchImpl?: typeof fetch;
}): Promise<Claim[]> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const baseUrl = options.baseUrl ?? NEAR_AI_BASE;
  const system = scoutSystemPrompt(options.strategy);
  const user = scoutUserPrompt(options.goal, options.shardBody);
  try {
    const content = await postChat({
      baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      system,
      user,
      fetchImpl,
      jsonMode: true,
    });
    return claimsFromModel(content);
  } catch (error) {
    const status = (error as { status?: number }).status;
    if (status !== 400) throw error;
    const content = await postChat({
      baseUrl,
      apiKey: options.apiKey,
      model: options.model,
      system,
      user,
      fetchImpl,
      jsonMode: false,
    });
    return claimsFromModel(content);
  }
}

export async function resolveModel(options: {
  baseUrl?: string;
  apiKey: string;
  preferred?: string;
  fetchImpl?: typeof fetch;
}): Promise<string> {
  if (options.preferred) return options.preferred;
  const baseUrl = options.baseUrl ?? NEAR_AI_BASE;
  try {
    const response = await (options.fetchImpl ?? fetch)(`${baseUrl}/models`, {
      headers: { Authorization: `Bearer ${options.apiKey}` },
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) return PREFERRED_MODELS[0];
    const json = (await response.json()) as { data?: { id?: string }[] };
    const ids = (json.data ?? []).map((model) => model.id).filter((id): id is string => Boolean(id));
    for (const preferred of PREFERRED_MODELS) {
      if (ids.includes(preferred)) return preferred;
    }
    return ids[0] ?? PREFERRED_MODELS[0];
  } catch {
    return PREFERRED_MODELS[0];
  }
}
