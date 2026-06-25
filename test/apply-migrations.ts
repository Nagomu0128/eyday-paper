import { applyD1Migrations, env } from "cloudflare:test";

// Apply the generated Drizzle migrations to the per-worker local D1 before tests.
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
