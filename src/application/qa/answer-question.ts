import type { OutputLang } from "../../domain/identity/profile";
import type { Embedder } from "../../domain/ingestion/extraction";
import type { ChunkRepository, PaperRepository } from "../../domain/library/types";
import type { AnswerGenerator, QaMessageRepository, Reranker } from "../../domain/qa/ports";
import type { VectorIndex } from "../../domain/search/vector-index";
import { AppError } from "../../shared/errors";
import { newId } from "../../shared/id";

export interface AnswerQuestionRequest {
  userId: string;
  paperId?: string;
  question: string;
  lang: OutputLang;
}

export interface AnswerQuestionResult {
  answer: string;
  grounded: boolean;
  citations: { section: string | null; page: number | null }[];
}

export interface AnswerQuestionDeps {
  papers: PaperRepository;
  chunks: ChunkRepository;
  embedder: Embedder;
  vectorIndex: VectorIndex;
  reranker: Reranker;
  generator: AnswerGenerator;
  history: QaMessageRepository;
}

const RECALL_K = 40;
const RERANK_K = 5;

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

    if (req.paperId) {
      const paper = await d.papers.findById(req.userId, req.paperId);
      if (!paper) throw new AppError("not_found", "paper not found");
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

    const generated = await d.generator.answer({ question, contexts, lang: req.lang });

    if (req.paperId) {
      await d.history.append({
        id: newId(),
        userId: req.userId,
        paperId: req.paperId,
        role: "user",
        content: question,
      });
      await d.history.append({
        id: newId(),
        userId: req.userId,
        paperId: req.paperId,
        role: "assistant",
        content: generated.answer,
      });
    }

    return {
      answer: generated.answer,
      grounded: generated.grounded,
      citations: topChunks.map((c) => ({ section: c.section, page: c.page })),
    };
  }
}
