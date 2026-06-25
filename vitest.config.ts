import { cloudflareTest } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

// Integration tests run inside the real Workers runtime (Miniflare) via the
// pool plugin, so D1/R2/KV bindings behave as in production. Unit tests run in
// the same isolate too. (v0.16 API: `cloudflareTest` plugin reads wrangler.jsonc.)
export default defineConfig({
  plugins: [cloudflareTest({ wrangler: { configPath: "./wrangler.jsonc" } })],
});
