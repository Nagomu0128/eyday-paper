import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { suggestion } from "../../db/schema";
import type {
  NewSuggestion,
  Suggestion,
  SuggestionKind,
  SuggestionRepository,
} from "../../domain/suggestion/ports";

type Row = typeof suggestion.$inferSelect;

const toSuggestion = (r: Row): Suggestion => ({
  id: r.id,
  userId: r.userId,
  externalId: r.externalId,
  source: r.source,
  title: r.title,
  authors: JSON.parse(r.authorsJson) as string[],
  year: r.year,
  url: r.url,
  arxivId: r.arxivId,
  doi: r.doi,
  kind: r.kind,
  score: r.score,
  reason: r.reason,
  status: r.status,
  createdAt: r.createdAt,
});

export class DrizzleSuggestionRepository implements SuggestionRepository {
  constructor(private readonly db: Database) {}

  async replaceSuggested(userId: string, rows: NewSuggestion[]): Promise<void> {
    await this.db
      .delete(suggestion)
      .where(and(eq(suggestion.userId, userId), eq(suggestion.status, "suggested")));
    if (rows.length === 0) return;
    // D1 caps bound parameters per query at 100; suggestion has 13 columns, so
    // insert at most 6 rows (78 params) per statement.
    // onConflictDoNothing: never re-suggest an already imported/dismissed paper.
    for (let i = 0; i < rows.length; i += 6) {
      await this.db
        .insert(suggestion)
        .values(
          rows.slice(i, i + 6).map((r) => ({
            id: r.id,
            userId,
            externalId: r.externalId,
            source: r.source,
            title: r.title,
            authorsJson: JSON.stringify(r.authors),
            year: r.year,
            url: r.url,
            arxivId: r.arxivId,
            doi: r.doi,
            kind: r.kind,
            score: r.score,
            reason: r.reason,
          })),
        )
        .onConflictDoNothing({
          target: [suggestion.userId, suggestion.source, suggestion.externalId],
        });
    }
  }

  async list(userId: string, kind?: SuggestionKind): Promise<Suggestion[]> {
    const conds = [eq(suggestion.userId, userId), eq(suggestion.status, "suggested")];
    if (kind) conds.push(eq(suggestion.kind, kind));
    const rows = await this.db
      .select()
      .from(suggestion)
      .where(and(...conds))
      .orderBy(desc(suggestion.score));
    return rows.map(toSuggestion);
  }

  async findById(userId: string, id: string): Promise<Suggestion | null> {
    const rows = await this.db
      .select()
      .from(suggestion)
      .where(and(eq(suggestion.userId, userId), eq(suggestion.id, id)));
    return rows[0] ? toSuggestion(rows[0]) : null;
  }

  async markImported(userId: string, id: string): Promise<void> {
    await this.db
      .update(suggestion)
      .set({ status: "imported" })
      .where(and(eq(suggestion.userId, userId), eq(suggestion.id, id)));
  }

  async dismiss(userId: string, id: string): Promise<void> {
    await this.db
      .update(suggestion)
      .set({ status: "dismissed" })
      .where(and(eq(suggestion.userId, userId), eq(suggestion.id, id)));
  }
}
