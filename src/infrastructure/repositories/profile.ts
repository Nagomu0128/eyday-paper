import { eq } from "drizzle-orm";
import type { Database } from "../../db/client";
import { profile } from "../../db/schema";
import type { Profile, ProfilePatch, ProfileRepository } from "../../domain/identity/profile";
import { AppError } from "../../shared/errors";

type Row = typeof profile.$inferSelect;

const arr = (json: string): string[] => {
  try {
    const v = JSON.parse(json);
    return Array.isArray(v) ? (v as string[]) : [];
  } catch {
    return [];
  }
};

const toProfile = (r: Row): Profile => ({
  userId: r.userId,
  interests: arr(r.interestsJson),
  domains: arr(r.domainsJson),
  organizations: arr(r.organizationsJson),
  avoid: arr(r.avoidJson),
  goal: r.goal,
  level: r.level,
  readability: r.readability,
  outputLang: r.outputLang,
  suggestHour: r.suggestHour,
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
    if (patch.domains !== undefined) set.domainsJson = JSON.stringify(patch.domains);
    if (patch.organizations !== undefined)
      set.organizationsJson = JSON.stringify(patch.organizations);
    if (patch.avoid !== undefined) set.avoidJson = JSON.stringify(patch.avoid);
    if (patch.goal !== undefined) set.goal = patch.goal;
    if (patch.level !== undefined) set.level = patch.level;
    if (patch.readability !== undefined) set.readability = patch.readability;
    if (patch.outputLang !== undefined) set.outputLang = patch.outputLang;
    if (patch.suggestHour !== undefined) set.suggestHour = patch.suggestHour;

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
