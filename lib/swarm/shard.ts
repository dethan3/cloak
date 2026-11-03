import type { SensitiveDocument, Shard } from "./types";

export function assignShards(
  documents: SensitiveDocument[],
  scoutCount: number,
): { shards: Shard[]; assignment: (string | null)[] } {
  const shards: Shard[] = [];
  const assignment: (string | null)[] = Array.from({ length: scoutCount }, () => null);

  if (documents.length <= scoutCount) {
    documents.forEach((doc, index) => {
      const shard: Shard = {
        id: `shard-${index + 1}`,
        index,
        documentIds: [doc.id],
        body: doc.body.trim(),
      };
      shards.push(shard);
      assignment[index] = shard.id;
    });
    return { shards, assignment };
  }

  for (let i = 0; i < scoutCount; i += 1) {
    shards.push({
      id: `shard-${i + 1}`,
      index: i,
      documentIds: [],
      body: "",
    });
    assignment[i] = shards[i].id;
  }

  documents.forEach((doc, index) => {
    const shard = shards[index % scoutCount];
    shard.documentIds.push(doc.id);
    shard.body = shard.body
      ? `${shard.body}\n\n---\n\n${doc.body.trim()}`
      : doc.body.trim();
  });

  return { shards, assignment };
}
