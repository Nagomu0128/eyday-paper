/**
 * Ingestion domain ports. Pure TypeScript — adapters live in infrastructure.
 * Metadata/references come from structured external APIs (more accurate than
 * PDF parsing); only body/formulas/tables are extracted from the PDF (§4.7).
 */

export type IngestInputKind = "arxiv" | "doi" | "url" | "pdf";

export interface IngestInput {
  kind: IngestInputKind;
  /** arXiv id, DOI, or URL. Empty for raw PDF uploads. */
  value: string;
  /** Original filename for PDF uploads (used as a fallback title). */
  filename?: string;
  /** Raw bytes for PDF uploads. */
  pdfBytes?: ArrayBuffer;
}

export interface ResolvedMetadata {
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  arxivId: string | null;
  abstract: string | null;
  sourceUrl: string | null;
  /** Direct PDF URL when known (e.g. arXiv); used to fetch the source. */
  pdfUrl: string | null;
  lang: string | null;
}

/** Resolves normalized metadata from structured external APIs (arXiv/Crossref/…). */
export interface MetadataResolver {
  resolve(input: IngestInput): Promise<ResolvedMetadata>;
}

/** Fetches the source PDF bytes (from a known PDF URL or the uploaded bytes). */
export interface SourceFetcher {
  fetchPdf(meta: ResolvedMetadata, input: IngestInput): Promise<ArrayBuffer | null>;
}

export interface ProcessJob {
  userId: string;
  paperId: string;
}

/** Producer port for the async ingestion/processing pipeline. */
export interface IngestionQueue {
  enqueueProcess(job: ProcessJob): Promise<void>;
}
