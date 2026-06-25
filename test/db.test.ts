import { env } from "cloudflare:test";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createDb } from "../src/db/client";
import { user } from "../src/db/schema";

describe("D1 + Drizzle auth schema (migrations applied)", () => {
  it("inserts and reads back a user with the extended Google fields", async () => {
    const db = createDb(env.DB);
    const id = crypto.randomUUID();
    await db.insert(user).values({
      id,
      name: "Test User",
      email: `${id}@example.com`,
      emailVerified: false,
      googleSub: "google-sub-123",
    });

    const rows = await db.select().from(user).where(eq(user.id, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]?.email).toContain("@example.com");
    expect(rows[0]?.googleSub).toBe("google-sub-123");
  });
});
