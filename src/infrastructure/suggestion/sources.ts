import type { ExternalPaper, SuggestionSource } from "../../domain/suggestion/ports";
import { fetchWithRetry } from "../http/fetch-retry";

const MAILTO = "eyday-paper@yoshidakazuya.com"; // OpenAlex/Crossref polite pool

type CollectInput = {
  interests: string[];
  seedArxivIds: string[];
  seedDois: string[];
  domains?: string[];
  organizations?: string[];
};

/** Merge the user's free-text tags (topics + fields + orgs) into search queries. */
const searchQueries = (input: CollectInput, max: number): string[] => {
  const all = [...input.interests, ...(input.domains ?? []), ...(input.organizations ?? [])]
    .map((s) => s.trim())
    .filter(Boolean);
  return [...new Set(all)].slice(0, max);
};

const tag = (s: string, t: string): string | null => {
  const m = s.match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`, "i"));
  return m?.[1]
    ? m[1]
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    : null;
};
const allNames = (s: string): string[] => {
  const out: string[] = [];
  const re = /<name>([\s\S]*?)<\/name>/gi;
  let m = re.exec(s);
  while (m) {
    if (m[1]) out.push(m[1].trim());
    m = re.exec(s);
  }
  return out;
};

/** Recent papers per interest from the arXiv Atom API (sorted by submission date). */
export class ArxivRecentSource implements SuggestionSource {
  async collect(input: CollectInput): Promise<ExternalPaper[]> {
    const qs = searchQueries(input, 4);
    const queries = qs.length > 0 ? qs : ["machine learning"];
    const out: ExternalPaper[] = [];
    for (const q of queries) {
      try {
        const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(q)}&sortBy=submittedDate&sortOrder=descending&max_results=8`;
        const res = await fetchWithRetry(url, {}, { retries: 1, timeoutMs: 8000 });
        if (!res.ok) continue;
        const xml = await res.text();
        for (const entry of xml.match(/<entry>[\s\S]*?<\/entry>/g) ?? []) {
          const id = (tag(entry, "id") ?? "").match(/abs\/(.+?)(?:v\d+)?$/)?.[1] ?? null;
          if (!id) continue;
          out.push({
            externalId: id,
            source: "arxiv",
            title: tag(entry, "title") ?? id,
            authors: allNames(entry),
            year: Number.parseInt((tag(entry, "published") ?? "").slice(0, 4), 10) || null,
            url: `https://arxiv.org/abs/${id}`,
            arxivId: id,
            doi: null,
            abstract: tag(entry, "summary"),
          });
        }
      } catch {
        // one failing query must not break the batch
      }
    }
    return out;
  }
}

/** Topical works from OpenAlex (polite pool). Comprehensive metadata. */
export class OpenAlexSource implements SuggestionSource {
  async collect(input: CollectInput): Promise<ExternalPaper[]> {
    const queries = searchQueries(input, 3);
    const out: ExternalPaper[] = [];
    for (const q of queries) {
      try {
        const url = `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per_page=8&mailto=${MAILTO}`;
        const res = await fetchWithRetry(url, {}, { retries: 1, timeoutMs: 8000 });
        if (!res.ok) continue;
        const data = (await res.json()) as {
          results?: {
            id?: string;
            title?: string;
            publication_year?: number;
            doi?: string;
            authorships?: { author?: { display_name?: string } }[];
          }[];
        };
        for (const w of data.results ?? []) {
          const id = w.id?.split("/").pop();
          if (!id || !w.title) continue;
          out.push({
            externalId: id,
            source: "openalex",
            title: w.title,
            authors: (w.authorships ?? []).map((a) => a.author?.display_name ?? "").filter(Boolean),
            year: w.publication_year ?? null,
            url: w.doi ?? w.id ?? null,
            arxivId: null,
            doi: w.doi?.replace(/^https?:\/\/doi\.org\//, "") ?? null,
            abstract: null,
          });
        }
      } catch {
        // ignore
      }
    }
    return out;
  }
}

/** Similar papers from Semantic Scholar Recommendations (seeded by the library). */
export class S2RecommendationsSource implements SuggestionSource {
  constructor(private readonly apiKey: string | undefined) {}

  async collect(input: CollectInput): Promise<ExternalPaper[]> {
    const seeds = input.seedArxivIds.slice(0, 10).map((id) => `arXiv:${id}`);
    if (seeds.length === 0) return [];
    try {
      const headers: Record<string, string> = { "content-type": "application/json" };
      if (this.apiKey) headers["x-api-key"] = this.apiKey;
      const res = await fetchWithRetry(
        "https://api.semanticscholar.org/recommendations/v1/papers?fields=title,year,externalIds,authors,abstract,url&limit=20",
        {
          method: "POST",
          headers,
          body: JSON.stringify({ positivePaperIds: seeds, negativePaperIds: [] }),
        },
        { retries: 1, timeoutMs: 8000 },
      );
      if (!res.ok) return [];
      const data = (await res.json()) as {
        recommendedPapers?: {
          paperId?: string;
          title?: string;
          year?: number;
          url?: string;
          abstract?: string;
          externalIds?: { ArXiv?: string; DOI?: string };
          authors?: { name?: string }[];
        }[];
      };
      return (data.recommendedPapers ?? [])
        .filter((p) => p.paperId && p.title)
        .map((p) => ({
          externalId: p.paperId as string,
          source: "s2" as const,
          title: p.title as string,
          authors: (p.authors ?? []).map((a) => a.name ?? "").filter(Boolean),
          year: p.year ?? null,
          url: p.url ?? null,
          arxivId: p.externalIds?.ArXiv ?? null,
          doi: p.externalIds?.DOI ?? null,
          abstract: p.abstract ?? null,
        }));
    } catch {
      return [];
    }
  }
}

/** Runs all sources in parallel and merges/de-duplicates the candidates. */
export class CompositeSuggestionSource implements SuggestionSource {
  constructor(private readonly sources: SuggestionSource[]) {}

  async collect(input: CollectInput): Promise<ExternalPaper[]> {
    const batches = await Promise.all(this.sources.map((s) => s.collect(input)));
    const seen = new Set<string>();
    const merged: ExternalPaper[] = [];
    for (const paper of batches.flat()) {
      const key = paper.arxivId ?? paper.doi ?? `${paper.source}:${paper.externalId}`;
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(paper);
    }
    return merged;
  }
}
