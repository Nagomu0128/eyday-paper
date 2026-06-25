export type PaperStatus = "unread" | "reading" | "read";
export type OutputLang = "ja" | "en";

export interface Paper {
  id: string;
  title: string;
  authors: string[];
  year: number | null;
  venue: string | null;
  doi: string | null;
  arxivId: string | null;
  abstract: string | null;
  status: PaperStatus;
  primaryFolderId: string | null;
  pdfR2Key: string | null;
  textR2Key: string | null;
}

export interface Tag {
  id: string;
  name: string;
  kind: "field" | "topic" | "method";
}

export interface Folder {
  id: string;
  name: string;
}

export interface ExtractedSection {
  heading: string | null;
  paragraphs: string[];
}

export interface ExtractedDoc {
  lang: string | null;
  sections: ExtractedSection[];
}

export interface Explanation {
  explanation: string;
  source: { section: string | null; page: number | null };
}

export interface Answer {
  answer: string;
  grounded: boolean;
  citations: { section: string | null; page: number | null }[];
}

export interface Summary {
  tldr: string;
  sections: { heading: string | null; summary: string }[];
}

export interface Suggestion {
  id: string;
  externalId: string;
  source: "s2" | "arxiv" | "openalex";
  title: string;
  authors: string[];
  year: number | null;
  url: string | null;
  kind: "classic" | "recent";
  score: number;
  reason: string | null;
}
