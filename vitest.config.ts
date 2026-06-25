import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Integration tests run inside the real Workers runtime (Miniflare). D1 schema is
// applied from the generated Drizzle migrations (TEST_MIGRATIONS + a setup file).
// AI/Vectorize are remote-only and stay port-mocked (remoteBindings:false).
// Auth secrets are mock values — fully local, never real credentials.
export default defineConfig(async () => {
  const migrations = await readD1Migrations("src/db/migrations");
  return {
    plugins: [
      cloudflareTest({
        remoteBindings: false,
        wrangler: { configPath: "./wrangler.jsonc" },
        miniflare: {
          bindings: {
            TEST_MIGRATIONS: migrations,
            BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
            BETTER_AUTH_URL: "https://eyday-paper.test",
            GOOGLE_CLIENT_ID: "mock-google-client-id",
            GOOGLE_CLIENT_SECRET: "mock-google-client-secret",
          },
        },
      }),
    ],
    test: {
      setupFiles: ["./test/apply-migrations.ts"],
    },
  };
});
