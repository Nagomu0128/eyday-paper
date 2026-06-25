import type { OutputLang } from "../identity/profile";

export interface QaMessage {
  id: string;
  userId: string;
  paperId: string;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface QaMessageRepository {
  append(msg: {
    id: string;
    userId: string;
    paperId: string;
    role: "user" | "assistant";
    content: string;
  }): Promise<void>;
  listByPaper(userId: string, paperId: string, limit?: number): Promise<QaMessage[]>;
}

export interface RerankDoc {
  id: string;
  text: string;
}

export interface RerankResult {
  id: string;
  score: number;
}

/** Cross-encoder reranker (bge-reranker-base) — the biggest precision lever. */
export interface Reranker {
  rerank(query: string, docs: RerankDoc[]): Promise<RerankResult[]>;
}

export interface AnswerContext {
  text: string;
  section: string | null;
  page: number | null;
}

export interface GroundedAnswer {
  answer: string;
  grounded: boolean;
}

/** Generates an answer grounded ONLY in the retrieved contexts (or says "not found"). */
export interface AnswerGenerator {
  answer(input: {
    question: string;
    contexts: AnswerContext[];
    lang: OutputLang;
  }): Promise<GroundedAnswer>;
}
