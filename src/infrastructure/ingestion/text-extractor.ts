import type {
  ExtractedDoc,
  ExtractedSection,
  TextExtractor,
} from "../../domain/ingestion/extraction";
import type { Paper } from "../../domain/library/types";
import { fetchWithRetry } from "../http/fetch-retry";

const decode = (s: string): string =>
  s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&");

const stripTags = (s: string): string =>
  decode(s.replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ")
    .replace(/\s+([.,;:!?)])/g, "$1")
    .trim();

/**
 * Parse HTML (e.g. arXiv's MathML-bearing HTML) into sections: headings (h1-h3)
 * start a new section, paragraphs (p) attach to the current one. Pure/testable.
 */
export const htmlToDoc = (html: string, lang: string | null = null): ExtractedDoc => {
  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "");

  const sections: ExtractedSection[] = [];
  let current: ExtractedSection = { heading: null, paragraphs: [] };
  const re = /<(h[1-3]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi;

  let m: RegExpExecArray | null = re.exec(body);
  while (m !== null) {
    const tag = (m[1] ?? "").toLowerCase();
    const text = stripTags(m[2] ?? "");
    if (text) {
      if (tag.startsWith("h")) {
        if (current.heading !== null || current.paragraphs.length > 0) sections.push(current);
        current = { heading: text, paragraphs: [] };
      } else {
        current.paragraphs.push(text);
      }
    }
    m = re.exec(body);
  }
  if (current.heading !== null || current.paragraphs.length > 0) sections.push(current);

  return { lang, sections };
};

/**
 * Staged extraction (§4.7): arXiv HTML (best — MathML, no OCR) when available,
 * otherwise an abstract-only fallback. Full PDF / multimodal-LLM extraction for
 * non-arXiv born-digital and scans is layered on once LLM keys are configured.
 */
export class CompositeTextExtractor implements TextExtractor {
  async extract(paper: Paper, _pdf: ArrayBuffer | null): Promise<ExtractedDoc> {
    if (paper.arxivId) {
      const html = await this.fetchArxivHtml(paper.arxivId);
      if (html) {
        const doc = htmlToDoc(html, paper.langDetected);
        if (doc.sections.some((s) => s.paragraphs.length > 0)) return doc;
      }
    }
    return {
      lang: paper.langDetected,
      sections: paper.abstract ? [{ heading: "Abstract", paragraphs: [paper.abstract] }] : [],
    };
  }

  private async fetchArxivHtml(arxivId: string): Promise<string | null> {
    try {
      const res = await fetchWithRetry(`https://arxiv.org/html/${arxivId}`, {}, { retries: 1 });
      if (!res.ok) return null;
      if (!(res.headers.get("content-type") ?? "").includes("html")) return null;
      return await res.text();
    } catch {
      return null;
    }
  }
}
