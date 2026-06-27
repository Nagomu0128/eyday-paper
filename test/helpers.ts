import { env } from "cloudflare:test";
import { createDb } from "../src/db/client";
import { user } from "../src/db/schema";
import type { RateLimiter } from "../src/domain/ratelimit/ports";

/** Permissive rate limiter for use-case tests that aren't exercising the limit. */
export const allowAllLimiter: RateLimiter = {
  checkAndIncrement: () => Promise.resolve({ allowed: true, remaining: 99 }),
};

/** Deny-everything limiter to assert the rate-limited path. */
export const denyAllLimiter: RateLimiter = {
  checkAndIncrement: () => Promise.resolve({ allowed: false, remaining: 0 }),
};

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
