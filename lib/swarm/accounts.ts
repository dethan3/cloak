import { createHash, randomBytes } from "node:crypto";
import { DEFAULT_PARENT, type StrategyId } from "./types";

const ACCOUNT_ID =
  /^(([a-z\d]+[-_])*[a-z\d]+\.)*([a-z\d]+[-_])*[a-z\d]+$/;

export function isValidNearAccount(id: string): boolean {
  return id.length >= 2 && id.length <= 64 && ACCOUNT_ID.test(id);
}

export function createMissionId(seed?: string): string {
  if (seed) {
    const cleaned = seed.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 6);
    if (cleaned.length === 6 && isValidNearAccount(`archivist-${cleaned}.testnet`)) {
      return cleaned;
    }
  }
  return randomBytes(3).toString("hex");
}

export function subAccount(
  role: StrategyId | "coord",
  missionId: string,
  parent = DEFAULT_PARENT,
): string {
  const id = `${role}-${missionId}.${parent}`.toLowerCase();
  if (!isValidNearAccount(id)) {
    throw new Error(`Refusing invalid NEAR account id "${id}".`);
  }
  return id;
}

export function simRef(parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex");
  return `sim:${digest.slice(0, 16)}`;
}

export function resolveParent(override?: string): string {
  const parent = (override || process.env.CLOAK_PARENT_ACCOUNT || DEFAULT_PARENT)
    .trim()
    .toLowerCase();
  if (!isValidNearAccount(parent)) {
    throw new Error(
      `CLOAK_PARENT_ACCOUNT "${parent}" is not a valid NEAR account id.`,
    );
  }
  return parent;
}
