import type { ProfileRepository } from "../../domain/identity/profile";
import type { PaperRepository } from "../../domain/library/types";
import type { RateLimiter } from "../../domain/ratelimit/ports";
import type {
  ExternalPaper,
  NewSuggestion,
  RankedSuggestion,
  SuggestionRanker,
  SuggestionRepository,
  SuggestionSource,
} from "../../domain/suggestion/ports";
import { AppError } from "../../shared/errors";
import { newId } from "../../shared/id";

export interface GenerateSuggestionsDeps {
  papers: PaperRepository;
  profiles: ProfileRepository;
  source: SuggestionSource;
  ranker: SuggestionRanker;
  suggestions: SuggestionRepository;
  limiter: RateLimiter;
}

/** Total suggestion generations per user per day, INCLUDING the daily cron run. */
const SUGGEST_DAILY_LIMIT = 2;

const keyOf = (p: { source: string; externalId: string }) => `${p.source}:${p.externalId}`;

/**
 * Heuristic ranking used when the LLM ranker is unavailable (e.g. AI Gateway
 * error). Keeps suggestions working with real candidates — newer papers go to
 * "recent", older to "classic" — instead of failing the whole batch.
 */
const fallbackRank = (candidates: ExternalPaper[]): RankedSuggestion[] => {
  const year = new Date().getFullYear();
  return candidates.slice(0, 12).map((c, i) => {
    const recent = (c.year ?? 0) >= year - 2;
    return {
      externalId: c.externalId,
      source: c.source,
      kind: recent ? "recent" : "classic",
      score: 1 - i * 0.05,
      reason: recent
        ? "あなたの興味に関連する最近の論文です。"
        : "あなたの蔵書・興味に関連する文献です。",
    };
  });
};

/**
 * Daily suggestion batch: gather the user's library + profile, collect candidates
 * from real external APIs, exclude already-owned papers, let the LLM rank and
 * justify them, and cache classic/recent results in D1. Facts come from the APIs;
 * the LLM only ranks and explains (never invents papers).
 */
export class GenerateSuggestions {
  constructor(private readonly deps: GenerateSuggestionsDeps) {}

  async execute(userId: string, opts?: { query?: string }): Promise<number> {
    const d = this.deps;

    // 2/day per user, counting the cron run — a cost backstop on the external
    // API fan-out + GPT ranker. The cron catches this and skips; the route 429s.
    const limit = await d.limiter.checkAndIncrement(userId, "suggestions", SUGGEST_DAILY_LIMIT);
    if (!limit.allowed) {
      throw new AppError("rate_limited", "本日の提案更新の上限に達しました。");
    }

    const profile = await d.profiles.get(userId);
    const library = await d.papers.list(userId, { limit: 500 });

    const ownedArxiv = new Set(library.map((p) => p.arxivId).filter((x): x is string => !!x));
    const ownedDoi = new Set(library.map((p) => p.doi).filter((x): x is string => !!x));

    const candidates = await d.source.collect({
      interests: profile?.interests ?? [],
      domains: profile?.domains ?? [],
      organizations: profile?.organizations ?? [],
      seedArxivIds: [...ownedArxiv],
      seedDois: [...ownedDoi],
      query: opts?.query?.trim() || undefined,
    });

    // Exclude already-owned papers (by arxiv id / doi) and de-duplicate.
    const seen = new Set<string>();
    const fresh: ExternalPaper[] = [];
    for (const c of candidates) {
      if (c.arxivId && ownedArxiv.has(c.arxivId)) continue;
      if (c.doi && ownedDoi.has(c.doi)) continue;
      const k = keyOf(c);
      if (seen.has(k)) continue;
      seen.add(k);
      fresh.push(c);
    }

    if (fresh.length === 0) {
      await d.suggestions.replaceSuggested(userId, []);
      return 0;
    }

    // The LLM only ranks/justifies real candidates. If it fails (e.g. gateway
    // error) or returns nothing, fall back to a heuristic so the batch still
    // produces grounded suggestions rather than 502-ing the whole request.
    let ranked: RankedSuggestion[];
    try {
      ranked = await d.ranker.rank({
        profile: {
          interests: profile?.interests ?? [],
          domains: profile?.domains ?? [],
          organizations: profile?.organizations ?? [],
          avoid: profile?.avoid ?? [],
          goal: profile?.goal ?? null,
          level: profile?.level ?? null,
        },
        candidates: fresh,
      });
      if (ranked.length === 0) ranked = fallbackRank(fresh);
    } catch (err) {
      console.warn("suggestion ranker failed; using heuristic fallback", err);
      ranked = fallbackRank(fresh);
    }

    const byId = new Map(fresh.map((c) => [keyOf(c), c]));
    const rows: NewSuggestion[] = [];
    for (const r of ranked) {
      const c = byId.get(keyOf(r));
      if (!c) continue;
      rows.push({
        id: newId(),
        userId,
        externalId: c.externalId,
        source: c.source,
        title: c.title,
        authors: c.authors,
        year: c.year,
        url: c.url,
        arxivId: c.arxivId,
        doi: c.doi,
        kind: r.kind,
        score: r.score,
        reason: r.reason,
      });
    }

    await d.suggestions.replaceSuggested(userId, rows);
    return rows.length;
  }
}
