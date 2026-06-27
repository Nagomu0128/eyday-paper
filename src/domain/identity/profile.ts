/** User profile that personalizes suggestions and AI output language. */
export type OutputLang = "ja" | "en";

export interface Profile {
  userId: string;
  /** Free-text "server tags" (Discord-style) that personalize suggestions. */
  interests: string[];
  domains: string[];
  organizations: string[];
  avoid: string[];
  /** Free-text research/learning goal; contextualizes the suggestion ranker. */
  goal: string | null;
  level: string | null;
  readability: string | null;
  outputLang: OutputLang;
  /** Preferred hour (0–23, JST) for the daily suggestion cron; null = 07:00 default. */
  suggestHour: number | null;
  updatedAt: Date;
}

export interface ProfilePatch {
  interests?: string[];
  domains?: string[];
  organizations?: string[];
  avoid?: string[];
  goal?: string | null;
  level?: string | null;
  readability?: string | null;
  outputLang?: OutputLang;
  suggestHour?: number | null;
}

export interface ProfileRepository {
  get(userId: string): Promise<Profile | null>;
  upsert(userId: string, patch: ProfilePatch): Promise<Profile>;
}
