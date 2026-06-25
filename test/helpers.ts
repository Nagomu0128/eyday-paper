import { env } from "cloudflare:test";
import { createDb } from "../src/db/client";
import { user } from "../src/db/schema";

/** Seed a real user row so FK-bound inserts (paper/chunk/...) succeed. */
export const seedUser = async (): Promise<string> => {
  const db = createDb(env.DB);
  const id = crypto.randomUUID();
  await db.insert(user).values({
    id,
    name: "Test User",
    email: `${id}@example.com`,
    emailVerified: false,
  });
  return id;
};
