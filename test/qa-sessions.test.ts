import { env } from "cloudflare:test";
import { describe, expect, it } from "vitest";
import { AnswerQuestion } from "../src/application/qa/answer-question";
import { createDb } from "../src/db/client";
import type { Embedder } from "../src/domain/ingestion/extraction";
import type { AnswerGenerator, Reranker } from "../src/domain/qa/ports";
import type { VectorIndex } from "../src/domain/search/vector-index";
import {
  DrizzleChunkRepository,
  DrizzlePaperRepository,
} from "../src/infrastructure/repositories/library";
import {
  DrizzleQaMessageRepository,
  DrizzleQaSessionRepository,
} from "../src/infrastructure/repositories/qa";
import { seedUser } from "./helpers";

const stubEmbedder: Embedder = { embed: (t) => Promise.resolve(t.map(() => [0.1, 0.2, 0.3])) };
const emptyIndex: VectorIndex = {
  query: () => Promise.resolve([]),
  upsert: () => Promise.resolve(),
  deleteVectors: () => Promise.resolve(),
};
const stubReranker: Reranker = { rerank: () => Promise.resolve([]) };

/** Records the history handed to the generator so we can assert multi-turn context. */
class RecordingGenerator implements AnswerGenerator {
  lastHistory: { role: "user" | "assistant"; content: string }[] | undefined;
  answer(input: {
    history?: { role: "user" | "assistant"; content: string }[];
  }): Promise<{ answer: string; grounded: boolean }> {
    this.lastHistory = input.history;
    return Promise.resolve({ answer: "stub answer", grounded: true });
  }
}

const build = () => {
  const db = createDb(env.DB);
  const generator = new RecordingGenerator();
  const deps = {
    papers: new DrizzlePaperRepository(db),
    chunks: new DrizzleChunkRepository(db),
    embedder: stubEmbedder,
    vectorIndex: emptyIndex,
    reranker: stubReranker,
    generator,
    history: new DrizzleQaMessageRepository(db),
    sessions: new DrizzleQaSessionRepository(db),
  };
  return { deps, generator };
};

describe("AnswerQuestion — Q&A sessions", () => {
  it("creates a session (auto-titled) on the first question and persists both turns", async () => {
    const { deps, generator } = build();
    const userId = await seedUser();
    const paper = await deps.papers.create({ id: crypto.randomUUID(), userId, title: "X" });

    const r = await new AnswerQuestion(deps).execute({
      userId,
      paperId: paper.id,
      question: "What is attention?",
      lang: "ja",
    });

    expect(r.sessionId).toBeTruthy();
    expect(generator.lastHistory).toEqual([]); // first turn → no prior history
    const sessions = await deps.sessions.listByPaper(userId, paper.id);
    expect(sessions).toHaveLength(1);
    expect(sessions[0]?.title).toContain("What is attention");
    const msgs = await deps.history.listBySession(userId, r.sessionId as string);
    expect(msgs.map((m) => m.role)).toEqual(["user", "assistant"]);
  });

  it("feeds prior turns of the SAME session to the generator (follow-up continuity)", async () => {
    const { deps, generator } = build();
    const userId = await seedUser();
    const paper = await deps.papers.create({ id: crypto.randomUUID(), userId, title: "X" });
    const qa = new AnswerQuestion(deps);

    const r1 = await qa.execute({ userId, paperId: paper.id, question: "Q1", lang: "ja" });
    const r2 = await qa.execute({
      userId,
      paperId: paper.id,
      question: "Q2",
      lang: "ja",
      sessionId: r1.sessionId as string,
    });

    expect(r2.sessionId).toBe(r1.sessionId);
    expect(generator.lastHistory).toEqual([
      { role: "user", content: "Q1" },
      { role: "assistant", content: "stub answer" },
    ]);
    const msgs = await deps.history.listBySession(userId, r1.sessionId as string);
    expect(msgs).toHaveLength(4); // two turns
  });

  it("rejects another tenant using someone else's session id", async () => {
    const { deps } = build();
    const owner = await seedUser();
    const other = await seedUser();
    const ownerPaper = await deps.papers.create({
      id: crypto.randomUUID(),
      userId: owner,
      title: "X",
    });
    const otherPaper = await deps.papers.create({
      id: crypto.randomUUID(),
      userId: other,
      title: "Y",
    });
    const r = await new AnswerQuestion(deps).execute({
      userId: owner,
      paperId: ownerPaper.id,
      question: "Q",
      lang: "ja",
    });

    await expect(
      new AnswerQuestion(deps).execute({
        userId: other,
        paperId: otherPaper.id,
        question: "Q",
        lang: "ja",
        sessionId: r.sessionId as string,
      }),
    ).rejects.toThrow();
  });
});
