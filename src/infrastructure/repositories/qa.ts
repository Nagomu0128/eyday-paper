import { and, asc, desc, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { qaMessage, qaSession } from "../../db/schema";
import type {
  QaMessage,
  QaMessageRepository,
  QaSession,
  QaSessionRepository,
} from "../../domain/qa/ports";
import { AppError } from "../../shared/errors";

export class DrizzleQaMessageRepository implements QaMessageRepository {
  constructor(private readonly db: Database) {}

  async append(msg: {
    id: string;
    userId: string;
    paperId: string;
    sessionId?: string | null;
    role: "user" | "assistant";
    content: string;
  }): Promise<void> {
    await this.db.insert(qaMessage).values({ ...msg, sessionId: msg.sessionId ?? null });
  }

  async listByPaper(userId: string, paperId: string, limit = 50): Promise<QaMessage[]> {
    return this.db
      .select()
      .from(qaMessage)
      .where(and(eq(qaMessage.userId, userId), eq(qaMessage.paperId, paperId)))
      .orderBy(asc(qaMessage.createdAt))
      .limit(limit);
  }

  async listBySession(userId: string, sessionId: string, limit = 100): Promise<QaMessage[]> {
    return this.db
      .select()
      .from(qaMessage)
      .where(and(eq(qaMessage.userId, userId), eq(qaMessage.sessionId, sessionId)))
      .orderBy(asc(qaMessage.createdAt))
      .limit(limit);
  }
}

export class DrizzleQaSessionRepository implements QaSessionRepository {
  constructor(private readonly db: Database) {}

  async create(input: {
    id: string;
    userId: string;
    paperId: string;
    title: string;
  }): Promise<QaSession> {
    const rows = await this.db.insert(qaSession).values(input).returning();
    const row = rows[0];
    if (!row) throw new AppError("internal", "qa session insert returned no row");
    return row;
  }

  async listByPaper(userId: string, paperId: string): Promise<QaSession[]> {
    return this.db
      .select()
      .from(qaSession)
      .where(and(eq(qaSession.userId, userId), eq(qaSession.paperId, paperId)))
      .orderBy(desc(qaSession.updatedAt));
  }

  async findById(userId: string, id: string): Promise<QaSession | null> {
    const rows = await this.db
      .select()
      .from(qaSession)
      .where(and(eq(qaSession.userId, userId), eq(qaSession.id, id)))
      .limit(1);
    return rows[0] ?? null;
  }

  async rename(userId: string, id: string, title: string): Promise<void> {
    await this.db
      .update(qaSession)
      .set({ title, updatedAt: new Date() })
      .where(and(eq(qaSession.userId, userId), eq(qaSession.id, id)));
  }

  async touch(userId: string, id: string): Promise<void> {
    await this.db
      .update(qaSession)
      .set({ updatedAt: new Date() })
      .where(and(eq(qaSession.userId, userId), eq(qaSession.id, id)));
  }

  async delete(userId: string, id: string): Promise<void> {
    await this.db.delete(qaSession).where(and(eq(qaSession.userId, userId), eq(qaSession.id, id)));
  }
}
