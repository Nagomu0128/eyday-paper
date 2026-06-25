# eyday-paper

A personal web app that lowers the barrier to reading papers: throw in a link or
PDF, and it auto-organizes, accumulates, and uses AI to help you **find,
understand, and decide what to read next**.

> Product/architecture source of truth: [`specs/design doc.md`](specs/design%20doc.md).
> Working conventions for contributors/agents: [`CLAUDE.md`](CLAUDE.md).

## Stack

One Cloudflare Worker serves the React client **and** the Hono API on the same
origin (no CORS). DDD layering with the dependency rule enforced by dependency-cruiser.

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind v4 |
| Backend | Hono on Cloudflare Workers (TypeScript) |
| Auth | Better Auth + Google OAuth (D1-native, Drizzle adapter) |
| Relational | Cloudflare D1 (SQLite) + Drizzle ORM / Kit |
| Object storage | Cloudflare R2 (PDFs, extracted text) |
| Vector search | Cloudflare Vectorize (D1 brute-force fallback behind the same port) |
| Embeddings / rerank | Workers AI (`bge-m3`, `bge-reranker-base`) |
| LLM routing | Cloudflare AI Gateway → OpenAI / Gemini |
| Async / scheduled | Queues (ingestion pipeline), Cron (daily suggestions) |
| IaC | Terraform (resource graph) + wrangler (code, migrations, secrets) |

## Features

- **Ingest** arXiv / DOI / URL / PDF → normalize metadata (external APIs), dedupe, store in R2.
- **Process** (queued): staged extraction → auto-tag → auto-folder (non-destructive) → chunk → embed → Vectorize.
- **Read**: reflow text as the star, original PDF one tap away; **explain-on-selection** with cited source spans; ja/en.
- **Q&A (RAG)**: dense retrieval → `bge-reranker-base` → grounded answer (answers only from chunks, cites, says "not found").
- **Summary**: TL;DR + section summaries (map-reduce, cached, ja/en).
- **Suggestions**: real APIs (Semantic Scholar / arXiv / OpenAlex) → LLM ranks/justifies (never invents) → daily Cron cache.
- **Manage**: profile, reading status, notes/highlights, dashboard.

Tenant isolation is non-negotiable: every table has `user_id`, every query filters
by it (Vectorize searches too), and cross-user tests prove no leakage.

## Develop

```sh
npm install
cp .dev.vars.example .dev.vars   # mock secrets for local dev
npm run dev                      # vite + Worker (same origin) via @cloudflare/vite-plugin
npm run check                    # format + lint + typecheck + depcruise + tests
```

Scripts: `dev`, `build`, `check`, `format`, `lint`, `typecheck`, `depcruise`,
`test`, `db:generate`, `db:migrate:local|remote`, `cf-typegen`.

## Deploy

See [docs/deploy.md](docs/deploy.md). Going live needs your Cloudflare account,
Google OAuth client, and API keys — summarized in
[REQUIRES_YOUR_ACTION.md](REQUIRES_YOUR_ACTION.md).
