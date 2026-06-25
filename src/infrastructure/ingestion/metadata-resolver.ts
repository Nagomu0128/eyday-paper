import { z } from "zod";
import type { IngestInput, MetadataResolver, ResolvedMetadata } from "../../domain/ingestion/ports";
import { AppError } from "../../shared/errors";
import { fetchWithRetry } from "../http/fetch-retry";

const empty = (over: Partial<ResolvedMetadata>): ResolvedMetadata => ({
  title: "Untitled",
  authors: [],
  year: null,
  venue: null,
  doi: null,
  arxivId: null,
  abstract: null,
  sourceUrl: null,
  pdfUrl: null,
  lang: null,
  ...over,
});

const firstTag = (xml: string, tag: string): string | null => {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "i"));
  return m?.[1] ? decodeEntities(m[1].trim()) : null;
};

const allTags = (xml: string, tag: string): string[] => {
  const out: string[] = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let m: RegExpExecArray | null = re.exec(xml);
  while (m !== null) {
    if (m[1]) out.push(decodeEntities(m[1].trim()));
    m = re.exec(xml);
  }
  return out;
};

const decodeEntities = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

const crossrefWork = z.object({
  message: z.object({
    title: z.array(z.string()).optional(),
    author: z
      .array(z.object({ given: z.string().optional(), family: z.string().optional() }))
      .optional(),
    "container-title": z.array(z.string()).optional(),
    issued: z.object({ "date-parts": z.array(z.array(z.number())).optional() }).optional(),
    abstract: z.string().optional(),
    DOI: z.string().optional(),
    URL: z.string().optional(),
    language: z.string().optional(),
  }),
});

/**
 * Resolves metadata from structured external APIs (arXiv Atom, Crossref). More
 * accurate and cheaper than parsing the PDF. OpenAlex/S2 enrichment can be layered
 * on later; the dedupe keys (arxiv_id/doi) are what ingestion needs first.
 */
export class HttpMetadataResolver implements MetadataResolver {
  async resolve(input: IngestInput): Promise<ResolvedMetadata> {
    switch (input.kind) {
      case "arxiv":
        return this.fromArxiv(input.value);
      case "doi":
        return this.fromDoi(input.value);
      case "url":
        return empty({ title: input.value, sourceUrl: input.value });
      case "pdf":
        return empty({ title: input.filename ?? "Untitled (PDF upload)" });
    }
  }

  private async fromArxiv(id: string): Promise<ResolvedMetadata> {
    const res = await fetchWithRetry(
      `https://export.arxiv.org/api/query?id_list=${encodeURIComponent(id)}`,
    );
    if (!res.ok) throw new AppError("upstream", `arXiv API ${res.status}`);
    const xml = await res.text();
    const entry = xml.match(/<entry>([\s\S]*?)<\/entry>/i)?.[1];
    if (!entry) throw new AppError("not_found", `arXiv id not found: ${id}`);

    const published = firstTag(entry, "published");
    const year = published ? Number.parseInt(published.slice(0, 4), 10) : null;
    return empty({
      title: firstTag(entry, "title") ?? `arXiv:${id}`,
      authors: allTags(entry, "name"),
      abstract: firstTag(entry, "summary"),
      arxivId: id,
      doi: firstTag(entry, "arxiv:doi"),
      year: Number.isFinite(year) ? year : null,
      sourceUrl: `https://arxiv.org/abs/${id}`,
      pdfUrl: `https://arxiv.org/pdf/${id}.pdf`,
    });
  }

  private async fromDoi(doi: string): Promise<ResolvedMetadata> {
    const res = await fetchWithRetry(`https://api.crossref.org/works/${encodeURIComponent(doi)}`);
    if (res.status === 404) throw new AppError("not_found", `DOI not found: ${doi}`);
    if (!res.ok) throw new AppError("upstream", `Crossref ${res.status}`);
    const parsed = crossrefWork.safeParse(await res.json());
    if (!parsed.success) throw new AppError("upstream", "unexpected Crossref response");
    const m = parsed.data.message;
    const year = m.issued?.["date-parts"]?.[0]?.[0] ?? null;
    return empty({
      title: m.title?.[0] ?? `DOI:${doi}`,
      authors: (m.author ?? [])
        .map((a) => [a.given, a.family].filter(Boolean).join(" "))
        .filter(Boolean),
      venue: m["container-title"]?.[0] ?? null,
      year,
      doi: m.DOI ?? doi,
      abstract: m.abstract ? decodeEntities(m.abstract.replace(/<[^>]+>/g, "")) : null,
      sourceUrl: m.URL ?? `https://doi.org/${doi}`,
      lang: m.language ?? null,
    });
  }
}
