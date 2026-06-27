export type SuggestionKind = "classic" | "recent";
export type SuggestionSourceName = "s2" | "arxiv" | "openalex";
export type SuggestionStatus = "suggested" | "imported" | "dismissed";

/** A candidate paper from a real external API (never invented by the LLM). */
export interface ExternalPaper {
  externalId: string;
  source: SuggestionSourceName;
  title: string;
  authors: string[];
  year: number | null;
  url: string | null;
  arxivId: string | null;
  doi: string | null;
  abstract: string | null;
}

/** Personalization signals used to seed candidate collection + ranking. */
export interface SuggestionProfile {
  interests: string[];
  level: string | null;
  domains?: string[];
  organizations?: string[];
  avoid?: string[];
  goal?: string | null;
}

export interface SuggestionSource {
  collect(input: {
    interests: string[];
    seedArxivIds: string[];
    seedDois: string[];
    domains?: string[];
    organizations?: string[];
    /** Ad-hoc free-text intent for this run; becomes the primary search axis. */
    query?: string;
  }): Promise<ExternalPaper[]>;
}

export interface RankedSuggestion {
  externalId: string;
  source: SuggestionSourceName;
  kind: SuggestionKind;
  score: number;
  reason: string;
}

/** LLM ranks/justifies real candidates (facts stay in the data, not the model). */
export interface SuggestionRanker {
  rank(input: {
    profile: SuggestionProfile;
    candidates: ExternalPaper[];
  }): Promise<RankedSuggestion[]>;
}

export interface Suggestion {
  id: string;
  userId: string;
  externalId: string;
  source: SuggestionSourceName;
  title: string;
  authors: string[];
  year: number | null;
  url: string | null;
  arxivId: string | null;
  doi: string | null;
  kind: SuggestionKind;
  score: number;
  reason: string | null;
  status: SuggestionStatus;
  createdAt: Date;
}

export interface NewSuggestion {
  id: string;
  userId: string;
  externalId: string;
  source: SuggestionSourceName;
  title: string;
  authors: string[];
  year: number | null;
  url: string | null;
  arxivId: string | null;
  doi: string | null;
  kind: SuggestionKind;
  score: number;
  reason: string | null;
}

export interface SuggestionRepository {
  /** Atomically replace the user's `suggested` rows with a fresh batch (keeps imported/dismissed). */
  replaceSuggested(userId: string, suggestions: NewSuggestion[]): Promise<void>;
  list(userId: string, kind?: SuggestionKind): Promise<Suggestion[]>;
  findById(userId: string, id: string): Promise<Suggestion | null>;
  markImported(userId: string, id: string): Promise<void>;
  dismiss(userId: string, id: string): Promise<void>;
}
