import { defineConfig } from "drizzle-kit";

// Drizzle Kit generates SQL migrations from the schema; they are applied to D1
// via `wrangler d1 migrations apply` (local/remote). Never edit a shipped
// migration — add a new one.
export default defineConfig({
  dialect: "sqlite",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
});
