import type { D1Migration } from "@cloudflare/vitest-pool-workers";

// `cloudflare:test` types `env` as `Cloudflare.Env`. Augment that namespace with
// the migrations array injected via miniflare bindings in vitest.config.ts.
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
