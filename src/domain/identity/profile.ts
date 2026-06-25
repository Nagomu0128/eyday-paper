/** User profile that personalizes suggestions and AI output language. */
export type OutputLang = "ja" | "en";

export interface Profile {
  userId: string;
  interests: string[];
  level: string | null;
  readability: string | null;
  outputLang: OutputLang;
  updatedAt: Date;
}

export interface ProfilePatch {
  interests?: string[];
  level?: string | null;
  readability?: string | null;
  outputLang?: OutputLang;
}

export interface ProfileRepository {
  get(userId: string): Promise<Profile | null>;
  upsert(userId: string, patch: ProfilePatch): Promise<Profile>;
}
