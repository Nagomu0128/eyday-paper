import { and, eq, inArray } from "drizzle-orm";
import type { Database } from "../../db/client";
import { chunkVector } from "../../db/schema";
import type {
  VectorIndex,
  VectorMatch,
  VectorQuery,
  VectorRecord,
} from "../../domain/search/vector-index";

/** Cosine similarity of two equal-length vectors; 0 if either is a zero vector. */
export const cosineSimilarity = (a: number[], b: number[]): number => {
  const len = Math.min(a.length, b.length);
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
};

/**
 * Resilience fallback for the swappable search layer: stores embeddings in D1
 * and ranks by brute-force cosine. Correct (no ANN approximation) at personal
 * scale. Vectorize is the production default; this keeps the app working if
 * Vectorize is unavailable. Always filters by `userId`.
 */
export class D1BruteForceIndex implements VectorIndex {
  constructor(private readonly db: Database) {}

  async upsert(records: VectorRecord[]): Promise<void> {
    for (const r of records) {
      await this.db
        .insert(chunkVector)
        .values({
          chunkId: r.id,
          userId: r.userId,
          paperId: r.paperId,
          chunkIdx: r.chunkIdx,
          section: r.section,
          embedding: r.values,
        })
        .onConflictDoUpdate({
          target: chunkVector.chunkId,
          set: { embedding: r.values, chunkIdx: r.chunkIdx, section: r.section },
        });
    }
  }

  async query(q: VectorQuery): Promise<VectorMatch[]> {
    const conds = [eq(chunkVector.userId, q.userId)];
    if (q.paperId) conds.push(eq(chunkVector.paperId, q.paperId));
    const rows = await this.db
      .select()
      .from(chunkVector)
      .where(and(...conds));

    return rows
      .map((row) => ({
        id: row.chunkId,
        score: cosineSimilarity(q.embedding, row.embedding),
        userId: row.userId,
        paperId: row.paperId,
        chunkIdx: row.chunkIdx,
        section: row.section,
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, q.topK);
  }

  async deleteVectors(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.db.delete(chunkVector).where(inArray(chunkVector.chunkId, ids));
  }
}
