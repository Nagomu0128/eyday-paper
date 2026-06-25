# Requires your action (mocked during autonomous build)

Everything in the app is implemented and tested, but a few things need **your**
real accounts/credentials to go live. Until then they are mocked so local dev,
tests, build, and `wrangler deploy --dry-run` all pass.

## 1. Google OAuth client (sign-in)
- Created by hand in the Google console — see [docs/oauth-bootstrap.md](docs/oauth-bootstrap.md).
- Mocked by: `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` in `.dev.vars`.
- Until done: sign-in redirects to Google and fails; everything behind auth is unreachable in prod.

## 2. Secrets (`wrangler secret put`)
`BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`,
`CF_ACCOUNT_ID`, `AI_GATEWAY_NAME`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
`S2_API_KEY` (optional). Mocked in `.dev.vars`.

## 3. Cloudflare resources
- **Terraform apply** (D1, R2, KV, Queue, custom domain) — needs `CLOUDFLARE_API_TOKEN`,
  `account_id`, `zone_id`, and the R2 state bucket. Config validated (`terraform validate`);
  not applied.
- **Vectorize index** + metadata indexes — `wrangler vectorize create …` (no Terraform resource).
- **AI Gateway** named `eyday-paper` + a dollar **spend limit**.
- Copy Terraform outputs (`database_id`, `kv id`, …) into `wrangler.jsonc` (currently placeholders).

## 4. Provider details to re-verify before first real run
- **Model IDs / prices** in `src/interface/http/composition.ts` and the design doc are 2026-06
  research values: `gemini-2.5-flash-lite` / `-flash`, `gpt-5.4` / `-mini`, `@cf/baai/bge-m3`,
  `@cf/baai/bge-reranker-base`. Confirm availability.
- **AI Gateway provider base-URL paths** in `src/infrastructure/ai/ai-gateway.ts`
  (especially the Gemini OpenAI-compatible path).

## Known follow-ups (working, but improvable)
- Full **multimodal PDF extraction** for non-arXiv born-digital/scans (needs LLM keys);
  today non-arXiv falls back to abstract text. arXiv uses real HTML extraction.
- **Hybrid keyword retrieval** (FTS5/BM25) to complement dense + rerank in RAG.
- Mobile paragraph/figure **tap-to-explain** (desktop selection→popover is implemented).

See [docs/deploy.md](docs/deploy.md) for the full runbook.
