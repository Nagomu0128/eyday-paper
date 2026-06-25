import type { OutputLang } from "../../domain/identity/profile";
import type { ExtractedDoc } from "../../domain/ingestion/extraction";
import type { PaperRepository } from "../../domain/library/types";
import { r2Keys } from "../../domain/storage/keys";
import type { ObjectStorage } from "../../domain/storage/object-storage";
import type { Summarizer, Summary } from "../../domain/summary/ports";
import { AppError } from "../../shared/errors";

export interface SummarizePaperRequest {
  userId: string;
  paperId: string;
  lang: OutputLang;
}

export interface SummarizePaperDeps {
  papers: PaperRepository;
  storage: ObjectStorage;
  summarizer: Summarizer;
}

/**
 * TL;DR + section summaries for a paper, in the requested language. Cached in R2
 * per (paper, lang) so it is computed once. Reads the structured text produced by
 * ingestion (never re-parses the PDF, never translates the original).
 */
export class SummarizePaper {
  constructor(private readonly deps: SummarizePaperDeps) {}

  async execute(req: SummarizePaperRequest): Promise<Summary> {
    const { papers, storage, summarizer } = this.deps;

    const paper = await papers.findById(req.userId, req.paperId);
    if (!paper) throw new AppError("not_found", "paper not found");

    const cacheKey = r2Keys.summary(req.userId, req.paperId, req.lang);
    const cached = await storage.getText(cacheKey);
    if (cached) return JSON.parse(cached) as Summary;

    if (!paper.textR2Key) throw new AppError("conflict", "text not ready");
    const docJson = await storage.getText(paper.textR2Key);
    if (!docJson) throw new AppError("conflict", "text not ready");
    const doc = JSON.parse(docJson) as ExtractedDoc;

    const sections = doc.sections
      .map((s) => ({ heading: s.heading, text: s.paragraphs.join("\n\n") }))
      .filter((s) => s.text.trim().length > 0);

    const summary = await summarizer.summarize({ title: paper.title, sections, lang: req.lang });
    await storage.put(cacheKey, JSON.stringify(summary), "application/json");
    return summary;
  }
}
