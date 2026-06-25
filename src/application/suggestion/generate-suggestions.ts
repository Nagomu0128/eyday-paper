import type { ProfileRepository } from "../../domain/identity/profile";
import type { PaperRepository } from "../../domain/library/types";
import type {
  ExternalPaper,
  NewSuggestion,
  SuggestionRanker,
  SuggestionRepository,
  SuggestionSource,
} from "../../domain/suggestion/ports";
import { newId } from "../../shared/id";

export interface GenerateSuggestionsDeps {
  papers: PaperRepository;
  profiles: ProfileRepository;
  source: SuggestionSource;
  ranker: SuggestionRanker;
  suggestions: SuggestionRepository;
}

const keyOf = (p: { source: string; externalId: string }) => `${p.source}:${p.externalId}`;

/**
 * Daily suggestion batch: gather the user's library + profile, collect candidates
 * from real external APIs, exclude already-owned papers, let the LLM rank and
 * justify them, and cache classic/recent results in D1. Facts come from the APIs;
 * the LLM only ranks and explains (never invents papers).
 */
export class GenerateSuggestions {
  constructor(private readonly deps: GenerateSuggestionsDeps) {}

  async execute(userId: string): Promise<number> {
    const d = this.deps;

    const profile = await d.profiles.get(userId);
    const library = await d.papers.list(userId, { limit: 500 });

    const ownedArxiv = new Set(library.map((p) => p.arxivId).filter((x): x is string => !!x));
    const ownedDoi = new Set(library.map((p) => p.doi).filter((x): x is string => !!x));

    const candidates = await d.source.collect({
      interests: profile?.interests ?? [],
      seedArxivIds: [...ownedArxiv],
      seedDois: [...ownedDoi],
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

    const ranked = await d.ranker.rank({
      profile: { interests: profile?.interests ?? [], level: profile?.level ?? null },
      candidates: fresh,
    });

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
        kind: r.kind,
        score: r.score,
        reason: r.reason,
      });
    }

    await d.suggestions.replaceSuggested(userId, rows);
    return rows.length;
  }
}
