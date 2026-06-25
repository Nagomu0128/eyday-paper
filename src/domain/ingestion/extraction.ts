import type { TagKind } from "../library/types";

/**
 * Structured body extracted from the best available source (§4.7). The reflow
 * reader renders this; chunking splits on these semantic boundaries.
 */
export interface ExtractedSection {
  heading: string | null;
  paragraphs: string[];
}

export interface ExtractedDoc {
  lang: string | null;
  sections: ExtractedSection[];
}

import type { Paper } from "../library/types";

/** Extracts structured text from a paper's source (arXiv HTML > text layer > OCR). */
export interface TextExtractor {
  extract(paper: Paper, pdf: ArrayBuffer | null): Promise<ExtractedDoc>;
}

export interface TagSuggestion {
  name: string;
  kind: TagKind;
}

/** Suggests field/topic/method tags from metadata + a body sample (cheap model). */
export interface Tagger {
  suggest(input: {
    title: string;
    abstract: string | null;
    sample: string;
  }): Promise<TagSuggestion[]>;
}

/** Picks the best home folder name given the existing folder structure. */
export interface FolderAssigner {
  assign(input: {
    existingFolders: string[];
    title: string;
    abstract: string | null;
    tags: string[];
  }): Promise<{ name: string }>;
}

/** Produces dense embeddings for chunk texts (bge-m3). */
export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}
