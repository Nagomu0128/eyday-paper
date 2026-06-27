import type { OutputLang } from "../identity/profile";

export interface QaSession {
  id: string;
  userId: string;
  paperId: string;
  title: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface QaSessionRepository {
  create(input: { id: string; userId: string; paperId: string; title: string }): Promise<QaSession>;
  listByPaper(userId: string, paperId: string): Promise<QaSession[]>;
  findById(userId: string, id: string): Promise<QaSession | null>;
  rename(userId: string, id: string, title: string): Promise<void>;
  /** Bump updatedAt so the session sorts to the top after a new message. */
  touch(userId: string, id: string): Promise<void>;
  delete(userId: string, id: string): Promise<void>;
}

export interface QaMessage {
  id: string;
  userId: string;
  paperId: string;
  sessionId: string | null;
  role: "user" | "assistant";
  content: string;
  createdAt: Date;
}

export interface QaMessageRepository {
  append(msg: {
    id: string;
    userId: string;
    paperId: string;
    sessionId?: string | null;
    role: "user" | "assistant";
    content: string;
  }): Promise<void>;
  listByPaper(userId: string, paperId: string, limit?: number): Promise<QaMessage[]>;
  listBySession(userId: string, sessionId: string, limit?: number): Promise<QaMessage[]>;
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
    /** Prior turns of the same session, oldest-first, for follow-up continuity. */
    history?: { role: "user" | "assistant"; content: string }[];
  }): Promise<GroundedAnswer>;
}
