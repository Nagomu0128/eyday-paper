import type { OutputLang } from "../../domain/identity/profile";
import type { Embedder } from "../../domain/ingestion/extraction";
import type { ChunkRepository, PaperRepository } from "../../domain/library/types";
import type {
  AnswerGenerator,
  QaMessageRepository,
  QaSessionRepository,
  Reranker,
} from "../../domain/qa/ports";
import type { RateLimiter } from "../../domain/ratelimit/ports";
import type { VectorIndex } from "../../domain/search/vector-index";
import { AppError } from "../../shared/errors";
import { newId } from "../../shared/id";

export interface AnswerQuestionRequest {
  userId: string;
  paperId?: string;
  question: string;
  lang: OutputLang;
  /** Conversation thread to append to; omitted → a new session is created. */
  sessionId?: string;
}

export interface AnswerQuestionResult {
  answer: string;
  grounded: boolean;
  citations: { section: string | null; page: number | null }[];
  /** The session the turn landed in (newly created when none was supplied). */
  sessionId: string | null;
}

export interface AnswerQuestionDeps {
  papers: PaperRepository;
  chunks: ChunkRepository;
  embedder: Embedder;
  vectorIndex: VectorIndex;
  reranker: Reranker;
  generator: AnswerGenerator;
  history: QaMessageRepository;
  sessions: QaSessionRepository;
  limiter: RateLimiter;
}

const RECALL_K = 40;
const RERANK_K = 5;
const HISTORY_TURNS = 6;
/** Generous per-user daily cap on real Q&A (GPT-mid) — a runaway/abuse backstop. */
const QA_DAILY_LIMIT = 30;

/** First line of the question, trimmed to a short session title. */
const titleFrom = (question: string): string => {
  const line = question.replace(/\s+/g, " ").trim();
  return line.length > 40 ? `${line.slice(0, 40)}…` : line || "新しいチャット";
};

/**
 * RAG: embed the question → dense retrieval (Vectorize, user-scoped, broad) →
 * rerank (bge-reranker, the precision lever) → grounded answer from the top
 * chunks only, with source spans. Tenant isolation is enforced twice: the vector
 * query filters by userId, and chunk text is re-fetched scoped by userId.
 */
export class AnswerQuestion {
  constructor(private readonly deps: AnswerQuestionDeps) {}

  async execute(req: AnswerQuestionRequest): Promise<AnswerQuestionResult> {
    const d = this.deps;
    const question = req.question.trim();
    if (question.length === 0) throw new AppError("validation", "question is required");

    const limit = await d.limiter.checkAndIncrement(req.userId, "qa", QA_DAILY_LIMIT);
    if (!limit.allowed) {
      throw new AppError("rate_limited", "本日の質問回数の上限に達しました。");
    }

    // Resolve the conversation thread up front so we can feed its prior turns to
    // the generator (follow-up continuity). Sessions only apply to a real paper.
    let sessionId: string | null = null;
    let priorHistory: { role: "user" | "assistant"; content: string }[] = [];
    if (req.paperId) {
      const paper = await d.papers.findById(req.userId, req.paperId);
      if (!paper) throw new AppError("not_found", "paper not found");

      if (req.sessionId) {
        const session = await d.sessions.findById(req.userId, req.sessionId);
        if (!session) throw new AppError("not_found", "session not found");
        sessionId = session.id;
        const prior = await d.history.listBySession(req.userId, sessionId);
        priorHistory = prior
          .slice(-HISTORY_TURNS)
          .map((m) => ({ role: m.role, content: m.content }));
      } else {
        sessionId = newId();
        await d.sessions.create({
          id: sessionId,
          userId: req.userId,
          paperId: req.paperId,
          title: titleFrom(question),
        });
      }
    }

    const [embedding] = await d.embedder.embed([question]);
    const matches = await d.vectorIndex.query({
      embedding: embedding ?? [],
      userId: req.userId,
      paperId: req.paperId,
      topK: RECALL_K,
    });

    // Re-fetch chunk text scoped by userId (belt-and-braces tenant isolation).
    const chunks = await d.chunks.findByIds(
      req.userId,
      matches.map((m) => m.id),
    );
    const byId = new Map(chunks.map((c) => [c.id, c]));
    const docs = matches
      .map((m) => byId.get(m.id))
      .filter((c): c is NonNullable<typeof c> => c !== undefined)
      .map((c) => ({ id: c.id, text: c.text }));

    let top = docs;
    if (docs.length > 0) {
      const ranked = await d.reranker.rerank(question, docs);
      top = ranked
        .slice(0, RERANK_K)
        .map((r) => docs.find((doc) => doc.id === r.id))
        .filter((doc): doc is NonNullable<typeof doc> => doc !== undefined);
    }

    const topChunks = top.map((doc) => byId.get(doc.id)).filter((c) => c !== undefined);
    const contexts = topChunks.map((c) => ({ text: c.text, section: c.section, page: c.page }));

    const generated = await d.generator.answer({
      question,
      contexts,
      lang: req.lang,
      history: priorHistory,
    });

    if (req.paperId && sessionId) {
      await d.history.append({
        id: newId(),
        userId: req.userId,
        paperId: req.paperId,
        sessionId,
        role: "user",
        content: question,
      });
      await d.history.append({
        id: newId(),
        userId: req.userId,
        paperId: req.paperId,
        sessionId,
        role: "assistant",
        content: generated.answer,
      });
      await d.sessions.touch(req.userId, sessionId);
    }

    return {
      answer: generated.answer,
      grounded: generated.grounded,
      citations: topChunks.map((c) => ({ section: c.section, page: c.page })),
      sessionId,
    };
  }
}
