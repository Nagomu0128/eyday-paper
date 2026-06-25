// Augments the wrangler-generated global `Env` with secret string bindings.
// Provided via `wrangler secret put` in prod, `.dev.vars` locally, and miniflare
// bindings in tests. Never hard-coded.
interface Env {
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  // AI Gateway routing + provider keys (LLM calls go through the gateway).
  CF_ACCOUNT_ID: string;
  AI_GATEWAY_NAME: string;
  GEMINI_API_KEY: string;
  OPENAI_API_KEY: string;
  // Semantic Scholar API key (optional — empty falls back to the public rate).
  S2_API_KEY: string;
}
