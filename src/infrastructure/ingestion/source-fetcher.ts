import type { IngestInput, ResolvedMetadata, SourceFetcher } from "../../domain/ingestion/ports";
import { fetchWithRetry } from "../http/fetch-retry";

/** Fetches the source PDF: uploaded bytes if present, else a known PDF URL. */
export class HttpSourceFetcher implements SourceFetcher {
  async fetchPdf(meta: ResolvedMetadata, input: IngestInput): Promise<ArrayBuffer | null> {
    if (input.kind === "pdf" && input.pdfBytes) return input.pdfBytes;

    const url = meta.pdfUrl ?? (meta.sourceUrl?.endsWith(".pdf") ? meta.sourceUrl : null);
    if (!url) return null;

    const res = await fetchWithRetry(url);
    if (!res.ok) return null;
    return res.arrayBuffer();
  }
}
