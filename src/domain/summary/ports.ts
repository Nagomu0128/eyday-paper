import type { OutputLang } from "../identity/profile";

export interface SummarySection {
  heading: string | null;
  summary: string;
}

export interface Summary {
  tldr: string;
  sections: SummarySection[];
}

export interface SummarizeInput {
  title: string;
  sections: { heading: string | null; text: string }[];
  lang: OutputLang;
}

/** TL;DR + per-section summaries (map-reduce). Originals are never translated. */
export interface Summarizer {
  summarize(input: SummarizeInput): Promise<Summary>;
}
