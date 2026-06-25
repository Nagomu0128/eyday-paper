// Augments the wrangler-generated global `Env` with secret string bindings.
// Provided via `wrangler secret put` in prod, `.dev.vars` locally, and miniflare
// bindings in tests. Never hard-coded.
interface Env {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
}
