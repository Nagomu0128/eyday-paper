import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Integration tests run inside the real Workers runtime (Miniflare) via the pool
// plugin, so D1/R2/KV bindings behave as in production. `remoteBindings: false`
// keeps the run fully local — AI/Vectorize are remote-only services and are
// mocked at the port level in tests, never called through the real binding.
export default defineConfig({
  plugins: [
    cloudflareTest({
      remoteBindings: false,
      wrangler: { configPath: "./wrangler.jsonc" },
    }),
  ],
});
