import type { InferenceMode, MissionInput, SensitiveDocument } from "./types";

export type ParseResult =
  | { ok: true; value: MissionInput }
  | { ok: false; error: string; hint: string };

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

export function parseMissionBody(body: unknown): ParseResult {
  const record = asRecord(body);
  if (!record) {
    return {
      ok: false,
      error: "The mission body was not an object.",
      hint: "Send JSON with goal, budgetUnits, deadlineIso, documents, scoutCount, and mode.",
    };
  }

  const goal = typeof record.goal === "string" ? record.goal.trim() : "";
  if (goal.length < 8 || goal.length > 1000) {
    return {
      ok: false,
      error: "The goal needs between 8 and 1000 characters.",
      hint: "State the decision the swarm should brief, then run again.",
    };
  }

  const budget = Number(record.budgetUnits);
  if (!Number.isInteger(budget) || budget < 1 || budget > 1_000_000) {
    return {
      ok: false,
      error: "Budget units must be a whole number from 1 to 1000000.",
      hint: "The sample mission uses 1000 units.",
    };
  }

  const deadlineIso = typeof record.deadlineIso === "string" ? record.deadlineIso : "";
  if (Number.isNaN(Date.parse(deadlineIso))) {
    return {
      ok: false,
      error: "The deadline is not a valid time.",
      hint: "Use an ISO time such as 2026-11-03T18:00:00.000Z.",
    };
  }

  const mode = record.mode === "near-ai" || record.mode === "simulation" ? record.mode : null;
  if (!mode) {
    return {
      ok: false,
      error: "Mode must be simulation or near-ai.",
      hint: "Choose Simulation to run with no API key.",
    };
  }

  const scoutCount = Number(record.scoutCount ?? 3);
  if (!Number.isInteger(scoutCount) || scoutCount < 2 || scoutCount > 4) {
    return {
      ok: false,
      error: "Scout count must be 2, 3, or 4.",
      hint: "The sample uses 3 scouts.",
    };
  }

  if (!Array.isArray(record.documents)) {
    return {
      ok: false,
      error: "Documents must be a list.",
      hint: "Load the Northwind packet or paste 2 to 4 snippets.",
    };
  }
  if (record.documents.length < 2 || record.documents.length > 4) {
    return {
      ok: false,
      error: "A mission needs 2 to 4 documents.",
      hint: "Load the Northwind packet or add another snippet.",
    };
  }

  const documents: SensitiveDocument[] = [];
  for (let index = 0; index < record.documents.length; index += 1) {
    const doc = asRecord(record.documents[index]);
    if (!doc) {
      return {
        ok: false,
        error: `Document ${index + 1} was not an object.`,
        hint: "Each document needs a title and a body.",
      };
    }
    const title = typeof doc.title === "string" ? doc.title.trim() : "";
    const text = typeof doc.body === "string" ? doc.body.trim() : "";
    if (title.length < 1 || title.length > 120) {
      return {
        ok: false,
        error: `Document ${index + 1} needs a title of 1 to 120 characters.`,
        hint: "Titles stay in the operator vault. They are not copied into the public brief.",
      };
    }
    if (text.length < 1 || text.length > 20000) {
      return {
        ok: false,
        error: `Document ${index + 1} needs a body of 1 to 20000 characters.`,
        hint: "Paste the snippet, or reload the sample packet.",
      };
    }
    const id = typeof doc.id === "string" && doc.id.trim() ? doc.id.trim().slice(0, 40) : `doc-${index + 1}`;
    documents.push({ id, title, body: text });
  }

  const parentAccount = typeof record.parentAccount === "string" ? record.parentAccount : undefined;

  return {
    ok: true,
    value: {
      goal,
      budgetUnits: budget,
      deadlineIso: new Date(deadlineIso).toISOString(),
      documents,
      scoutCount,
      mode: mode as InferenceMode,
      parentAccount,
    },
  };
}
