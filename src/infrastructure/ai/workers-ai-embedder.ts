import type { Embedder } from "../../domain/ingestion/extraction";

type EmbeddingRun = (model: string, input: { text: string[] }) => Promise<{ data: number[][] }>;

/** Multilingual dense embeddings via Workers AI (bge-m3, 1024-d). */
export class WorkersAiEmbedder implements Embedder {
  constructor(
    private readonly ai: Ai,
    private readonly model = "@cf/baai/bge-m3",
  ) {}

  async embed(texts: string[]): Promise<number[][]> {
    if (texts.length === 0) return [];
    const run = (this.ai as unknown as { run: EmbeddingRun }).run;
    const res = await run.call(this.ai, this.model, { text: texts });
    return res.data;
  }
}
