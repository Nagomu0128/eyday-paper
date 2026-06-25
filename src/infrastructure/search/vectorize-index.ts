import type {
  VectorIndex,
  VectorMatch,
  VectorQuery,
  VectorRecord,
} from "../../domain/search/vector-index";

/**
 * Primary search backend (Cloudflare Vectorize). Tenant isolation is enforced
 * via a metadata `$eq` filter on `userId` (and optionally `paperId`).
 * NOTE: metadata indexes for `userId`/`paperId` must be created once via
 * `wrangler vectorize create-metadata-index` (see infra/README.md).
 */
export class VectorizeIndexAdapter implements VectorIndex {
  constructor(private readonly index: VectorizeIndex) {}

  async upsert(records: VectorRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.index.upsert(
      records.map((r) => ({
        id: r.id,
        values: r.values,
        metadata: {
          userId: r.userId,
          paperId: r.paperId,
          chunkIdx: r.chunkIdx,
          section: r.section ?? "",
        },
      })),
    );
  }

  async query(q: VectorQuery): Promise<VectorMatch[]> {
    const filter: Record<string, unknown> = { userId: { $eq: q.userId } };
    if (q.paperId) filter.paperId = { $eq: q.paperId };
    const res = await this.index.query(q.embedding, {
      topK: q.topK,
      filter: filter as VectorizeVectorMetadataFilter,
      returnMetadata: "all",
    });
    return res.matches.map((m) => ({
      id: m.id,
      score: m.score,
      userId: String(m.metadata?.userId ?? q.userId),
      paperId: String(m.metadata?.paperId ?? ""),
      chunkIdx: Number(m.metadata?.chunkIdx ?? 0),
      section: (m.metadata?.section as string) || null,
    }));
  }

  async deleteVectors(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await this.index.deleteByIds(ids);
  }
}
