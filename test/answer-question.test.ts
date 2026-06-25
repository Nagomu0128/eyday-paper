import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { AnswerQuestion } from "../src/application/qa/answer-question";
import { createDb } from "../src/db/client";
import type { Embedder } from "../src/domain/ingestion/extraction";
import type {
  AnswerContext,
  AnswerGenerator,
  GroundedAnswer,
  RerankDoc,
  Reranker,
  RerankResult,
} from "../src/domain/qa/ports";
import type { VectorIndex, VectorMatch } from "../src/domain/search/vector-index";
import {
  DrizzleChunkRepository,
  DrizzlePaperRepository,
} from "../src/infrastructure/repositories/library";
import { DrizzleQaMessageRepository } from "../src/infrastructure/repositories/qa";
import { seedUser } from "./helpers";

class StubEmbedder implements Embedder {
  embed(texts: string[]): Promise<number[][]> {
    return Promise.resolve(texts.map(() => [1, 0, 0]));
  }
}
class ReverseReranker implements Reranker {
  rerank(_q: string, docs: RerankDoc[]): Promise<RerankResult[]> {
    return Promise.resolve(docs.map((d, i) => ({ id: d.id, score: i })).reverse());
  }
}
class CapturingGenerator implements AnswerGenerator {
  lastContexts: AnswerContext[] = [];
  answer(input: { contexts: AnswerContext[] }): Promise<GroundedAnswer> {
    this.lastContexts = input.contexts;
    return Promise.resolve({
      answer: input.contexts.length ? `cited ${input.contexts.length}` : "not found",
      grounded: input.contexts.length > 0,
    });
  }
}
class StubIndex implements VectorIndex {
  constructor(private readonly matchIds: string[]) {}
  upsert(): Promise<void> {
    return Promise.resolve();
  }
  query(): Promise<VectorMatch[]> {
    return Promise.resolve(
      this.matchIds.map((id, i) => ({
        id,
        score: 1 - i * 0.01,
        userId: "?",
        paperId: "?",
        chunkIdx: i,
        section: null,
      })),
    );
  }
  deleteVectors(): Promise<void> {
    return Promise.resolve();
  }
}

describe("AnswerQuestion (RAG)", () => {
  it("retrieves user-scoped, reranks, answers grounded, and saves history", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const chunks = new DrizzleChunkRepository(db);
    const history = new DrizzleQaMessageRepository(db);
    const u1 = await seedUser();
    const u2 = await seedUser();
    const p1 = await papers.create({ id: crypto.randomUUID(), userId: u1, title: "P1" });
    const p2 = await papers.create({ id: crypto.randomUUID(), userId: u2, title: "P2" });

    const c1 = crypto.randomUUID();
    const c2 = crypto.randomUUID();
    const cX = crypto.randomUUID();
    await chunks.bulkCreate([
      { id: c1, userId: u1, paperId: p1.id, idx: 0, section: "Intro", text: "alpha text" },
      { id: c2, userId: u1, paperId: p1.id, idx: 1, section: "Method", text: "beta text" },
    ]);
    await chunks.bulkCreate([
      { id: cX, userId: u2, paperId: p2.id, idx: 0, section: "Secret", text: "leak" },
    ]);

    const gen = new CapturingGenerator();
    const uc = new AnswerQuestion({
      papers,
      chunks,
      embedder: new StubEmbedder(),
      vectorIndex: new StubIndex([c1, c2, cX]), // index leaks a cross-tenant id
      reranker: new ReverseReranker(),
      generator: gen,
      history,
    });

    const res = await uc.execute({
      userId: u1,
      paperId: p1.id,
      question: "what is alpha?",
      lang: "en",
    });

    // Cross-tenant chunk is filtered out by user-scoped findByIds.
    expect(gen.lastContexts.map((x) => x.text)).not.toContain("leak");
    expect(gen.lastContexts).toHaveLength(2);
    // Reranker reversed [c1,c2] -> [c2,c1]; top context is the Method chunk.
    expect(gen.lastContexts[0]?.section).toBe("Method");
    expect(res.grounded).toBe(true);
    expect(res.citations[0]?.section).toBe("Method");

    const msgs = await history.listByPaper(u1, p1.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]?.role).toBe("user");
    expect(msgs[1]?.role).toBe("assistant");
  });

  it("returns an ungrounded not-found answer when retrieval is empty", async () => {
    const db = createDb(env.DB);
    const papers = new DrizzlePaperRepository(db);
    const u1 = await seedUser();
    const p1 = await papers.create({ id: crypto.randomUUID(), userId: u1, title: "P" });

    const res = await new AnswerQuestion({
      papers,
      chunks: new DrizzleChunkRepository(db),
      embedder: new StubEmbedder(),
      vectorIndex: new StubIndex([]),
      reranker: new ReverseReranker(),
      generator: new CapturingGenerator(),
      history: new DrizzleQaMessageRepository(db),
    }).execute({ userId: u1, paperId: p1.id, question: "q", lang: "en" });

    expect(res.grounded).toBe(false);
    expect(res.citations).toHaveLength(0);
  });
});
