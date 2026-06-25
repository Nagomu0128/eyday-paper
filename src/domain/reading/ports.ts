import type { OutputLang } from "../identity/profile";

/** Input to the explain capability: a selection plus its surrounding context. */
export interface ExplainInput {
  title: string;
  selectedText: string;
  context: string | null;
  section: string | null;
  page: number | null;
  lang: OutputLang;
}

export interface SourceSpan {
  section: string | null;
  page: number | null;
}

export interface Explanation {
  explanation: string;
  source: SourceSpan;
}

/** Explains a selected passage/figure/formula on the stable text layer. */
export interface Explainer {
  explain(input: ExplainInput): Promise<Explanation>;
}
