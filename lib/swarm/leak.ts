import { LEAK_WINDOW } from "./types";

export function normalizeText(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function windows(text: string, size: number): string[] {
  const n = normalizeText(text);
  if (n.length < size) return [];
  const out: string[] = [];
  for (let i = 0; i <= n.length - size; i += 1) out.push(n.slice(i, i + size));
  return out;
}

export function leaksInto(
  claim: string,
  shardBodies: string[],
  size = LEAK_WINDOW,
): boolean {
  const claimWindows = windows(claim, size);
  if (claimWindows.length === 0) return false;
  const sealed = new Set<string>();
  for (const body of shardBodies) {
    for (const w of windows(body, size)) sealed.add(w);
  }
  return claimWindows.some((w) => sealed.has(w));
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function redactOverlaps(
  summary: string,
  shardBodies: string[],
  size = LEAK_WINDOW,
): { text: string; count: number } {
  const sealed = new Set<string>();
  for (const body of shardBodies) {
    for (const w of windows(body, size)) sealed.add(w);
  }
  let text = summary;
  let count = 0;
  for (const w of sealed) {
    if (!normalizeText(text).includes(w)) continue;
    const pattern = w.split(" ").map(escapeRegExp).join("\\s+");
    const re = new RegExp(pattern, "i");
    if (!re.test(text)) continue;
    text = text.replace(re, "[sealed]");
    count += 1;
  }
  return { text, count };
}
