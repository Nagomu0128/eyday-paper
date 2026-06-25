import { and, asc, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { qaMessage } from "../../db/schema";
import type { QaMessage, QaMessageRepository } from "../../domain/qa/ports";

export class DrizzleQaMessageRepository implements QaMessageRepository {
  constructor(private readonly db: Database) {}

  async append(msg: {
    id: string;
    userId: string;
    paperId: string;
    role: "user" | "assistant";
    content: string;
  }): Promise<void> {
    await this.db.insert(qaMessage).values(msg);
  }

  async listByPaper(userId: string, paperId: string, limit = 50): Promise<QaMessage[]> {
    return this.db
      .select()
      .from(qaMessage)
      .where(and(eq(qaMessage.userId, userId), eq(qaMessage.paperId, paperId)))
      .orderBy(asc(qaMessage.createdAt))
      .limit(limit);
  }
}
