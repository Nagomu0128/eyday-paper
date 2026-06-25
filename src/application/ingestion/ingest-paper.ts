import type {
  IngestInput,
  IngestionQueue,
  MetadataResolver,
  SourceFetcher,
} from "../../domain/ingestion/ports";
import type { PaperRepository } from "../../domain/library/types";
import { r2Keys } from "../../domain/storage/keys";
import type { ObjectStorage } from "../../domain/storage/object-storage";
import { newId } from "../../shared/id";

export interface IngestPaperDeps {
  papers: PaperRepository;
  storage: ObjectStorage;
  resolver: MetadataResolver;
  fetcher: SourceFetcher;
  queue: IngestionQueue;
}

export interface IngestResult {
  paperId: string;
  deduped: boolean;
}

/**
 * Request-path use case: resolve metadata, dedupe by arxiv_id/doi, store the
 * source PDF in R2, create the paper (status=unread), and enqueue the heavy
 * processing job. Keep this light/I/O-bound; extraction/embedding run async.
 */
export class IngestPaper {
  constructor(private readonly deps: IngestPaperDeps) {}

  async execute(userId: string, input: IngestInput): Promise<IngestResult> {
    const { papers, storage, resolver, fetcher, queue } = this.deps;

    const meta = await resolver.resolve(input);

    // Dedupe within the user's library (never across users).
    const existing =
      (meta.arxivId ? await papers.findByArxivId(userId, meta.arxivId) : null) ??
      (meta.doi ? await papers.findByDoi(userId, meta.doi) : null);
    if (existing) {
      return { paperId: existing.id, deduped: true };
    }

    const paperId = newId();

    let pdfKey: string | null = null;
    const pdf = await fetcher.fetchPdf(meta, input);
    if (pdf) {
      pdfKey = r2Keys.pdf(userId, paperId);
      await storage.put(pdfKey, pdf, "application/pdf");
    }

    await papers.create({
      id: paperId,
      userId,
      title: meta.title,
      authors: meta.authors,
      year: meta.year,
      venue: meta.venue,
      doi: meta.doi,
      arxivId: meta.arxivId,
      abstract: meta.abstract,
      sourceUrl: meta.sourceUrl,
      langDetected: meta.lang,
      pdfR2Key: pdfKey,
    });

    await queue.enqueueProcess({ userId, paperId });

    return { paperId, deduped: false };
  }
}
