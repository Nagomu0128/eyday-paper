import type { RerankDoc, Reranker, RerankResult } from "../../domain/qa/ports";

type RerankRun = (
  model: string,
  input: { query: string; contexts: { text: string }[] },
) => Promise<{ response: { id: number; score: number }[] }>;

/** Cross-encoder reranker via Workers AI (bge-reranker-base). */
export class WorkersAiReranker implements Reranker {
  constructor(
    private readonly ai: Ai,
    private readonly model = "@cf/baai/bge-reranker-base",
  ) {}

  async rerank(query: string, docs: RerankDoc[]): Promise<RerankResult[]> {
    if (docs.length === 0) return [];
    const run = (this.ai as unknown as { run: RerankRun }).run;
    const res = await run.call(this.ai, this.model, {
      query,
      contexts: docs.map((d) => ({ text: d.text })),
    });
    return res.response
      .map((r) => ({ id: docs[r.id]?.id ?? "", score: r.score }))
      .filter((r) => r.id !== "")
      .sort((a, b) => b.score - a.score);
  }
}
