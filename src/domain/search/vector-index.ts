/**
 * Vector search port. Implemented by Vectorize (primary) and a D1 brute-force
 * fallback — both enforce tenant isolation: every query filters by `userId`
 * (optionally `paperId`). The search layer is swappable behind this interface.
 */
export interface VectorRecord {
  id: string;
  values: number[];
  userId: string;
  paperId: string;
  chunkIdx: number;
  section: string | null;
}

export interface VectorQuery {
  embedding: number[];
  userId: string;
  paperId?: string;
  topK: number;
}

export interface VectorMatch {
  id: string;
  score: number;
  userId: string;
  paperId: string;
  chunkIdx: number;
  section: string | null;
}

export interface VectorIndex {
  upsert(records: VectorRecord[]): Promise<void>;
  query(query: VectorQuery): Promise<VectorMatch[]>;
  /** Delete by vector id (= chunk id). Callers derive ids from user-scoped chunks. */
  deleteVectors(ids: string[]): Promise<void>;
}
