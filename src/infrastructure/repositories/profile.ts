import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { profile } from "../../db/schema";
import type { Profile, ProfilePatch, ProfileRepository } from "../../domain/identity/profile";
import { AppError } from "../../shared/errors";

type Row = typeof profile.$inferSelect;

const toProfile = (r: Row): Profile => ({
  userId: r.userId,
  interests: JSON.parse(r.interestsJson) as string[],
  level: r.level,
  readability: r.readability,
  outputLang: r.outputLang,
  updatedAt: r.updatedAt,
});

export class DrizzleProfileRepository implements ProfileRepository {
  constructor(private readonly db: Database) {}

  async get(userId: string): Promise<Profile | null> {
    const rows = await this.db.select().from(profile).where(eq(profile.userId, userId));
    return rows[0] ? toProfile(rows[0]) : null;
  }

  async upsert(userId: string, patch: ProfilePatch): Promise<Profile> {
    const set: Partial<typeof profile.$inferInsert> = { updatedAt: new Date() };
    if (patch.interests !== undefined) set.interestsJson = JSON.stringify(patch.interests);
    if (patch.level !== undefined) set.level = patch.level;
    if (patch.readability !== undefined) set.readability = patch.readability;
    if (patch.outputLang !== undefined) set.outputLang = patch.outputLang;

    await this.db
      .insert(profile)
      .values({ userId, ...set })
      .onConflictDoUpdate({ target: profile.userId, set });

    const rows = await this.db.select().from(profile).where(eq(profile.userId, userId));
    const row = rows[0];
    if (!row) throw new AppError("internal", "profile upsert returned no row");
    return toProfile(row);
  }
}
