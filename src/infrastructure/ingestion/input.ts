import type { IngestInput } from "../../domain/ingestion/ports";
import { AppError } from "../../shared/errors";

const ARXIV_NEW = /^\d{4}\.\d{4,5}(v\d+)?$/;
const ARXIV_OLD = /^[a-z-]+(\.[A-Z]{2})?\/\d{7}(v\d+)?$/;
const DOI = /^10\.\d{4,9}\/\S+$/;

const stripArxivVersion = (id: string): string => id.replace(/v\d+$/, "");

/**
 * Classify a raw text input (validated at the interface edge) into an arXiv id,
 * DOI, or generic URL. Throws a validation error if unrecognized.
 */
export const detectIngestInput = (raw: string): IngestInput => {
  const v = raw.trim();
  if (v.length === 0) throw new AppError("validation", "empty ingest input");

  const arxivUrl = v.match(/arxiv\.org\/(?:abs|pdf)\/([^?#\s]+?)(?:\.pdf)?$/i);
  if (arxivUrl?.[1]) return { kind: "arxiv", value: stripArxivVersion(arxivUrl[1]) };

  const doiUrl = v.match(/doi\.org\/(10\.\d{4,9}\/\S+)$/i);
  if (doiUrl?.[1]) return { kind: "doi", value: doiUrl[1] };

  const bare = v.replace(/^arxiv:/i, "");
  if (ARXIV_NEW.test(bare) || ARXIV_OLD.test(bare)) {
    return { kind: "arxiv", value: stripArxivVersion(bare) };
  }
  if (DOI.test(v)) return { kind: "doi", value: v };
  if (/^https?:\/\//i.test(v)) return { kind: "url", value: v };

  throw new AppError("validation", `unrecognized ingest input: ${v}`);
};
