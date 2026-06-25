# CLAUDE.md

> [!CAUTION]
> **TOP PRIORITY — STOP AT 97% USAGE.** When the usage limit reaches 97%, halt work
> immediately. Always keep some usage in reserve; never run the usage limit to 100%.

Guidance for AI agents working in this repository. Read this before making changes.
The authoritative product/architecture reference is [`specs/design doc.md`](specs/design%20doc.md);
this file captures **how we work** and the conventions that follow from it.

> [!IMPORTANT]
> **Always consult [`specs/design doc.md`](specs/design%20doc.md) for every task.**
> It is the single source of truth for product scope, decided design choices, the tech-stack
> rationale, data model, data flows, accuracy/cost strategy, and the underlying **principles
> (原則)** behind each decision. Re-read the relevant section *before* you start any task and
> *before* finalizing changes — do not rely on memory or on this file alone.
> - It is a **living document** that changes; re-check it each time rather than assuming it is
>   unchanged. When your work contradicts or outdates it, update the doc in the same PR.
> - Prices, free tiers, and model IDs in it are **2026-06 research values** — re-verify against
>   official docs right before implementing anything that depends on them.
> - When CLAUDE.md and the design doc disagree on product/architecture intent, the **design doc
>   wins**; fix CLAUDE.md to match.

---

## 1. Project Overview

**eyday-paper** is a personal web app that lowers the barrier to reading papers: throw in a
link or PDF, and it auto-organizes, accumulates, and uses AI to help you *find, understand,
and decide what to read next*.

- **Deploy target:** `eyday-paper.yoshidakazuya.com`
- **Core domain / product axis:** "how much can we lower the barrier to reading." When a
  decision is unclear, choose the option that serves this axis. Defer peripheral features
  (elaborate permissions, social features).
- **Users:** single user for now, but **data is partitioned by user boundary** so multi-user
  is possible later. Build only the seam, not the full generality (YAGNI).
- **Status:** greenfield. Most stack choices below are decided in the design doc; wire up the
  concrete tooling as you scaffold, and keep this file in sync.

---

## 2. Tech Stack

| Layer | Choice |
|---|---|
| Frontend | React + Vite + TypeScript, Tailwind, pdf.js |
| Backend | Hono on Cloudflare Workers (TypeScript) |
| Auth | Better Auth + Google OAuth (D1-native) |
| Relational data | Cloudflare D1 (SQLite) + Drizzle ORM / Drizzle Kit migrations |
| Object storage | Cloudflare R2 (PDFs, extracted text, figures) |
| Vector search | Cloudflare Vectorize (with D1 brute-force fallback) |
| Embeddings / rerank | Workers AI (`bge-m3`, `bge-reranker-base`) |
| LLM routing | Cloudflare AI Gateway → OpenAI / Gemini |
| Async / scheduled | Queues, Cron Triggers, `ctx.waitUntil()` |
| Heavy parsing (later) | Cloudflare Containers ($5/mo, only if cost requires) |
| Infra-as-code | Terraform (resources) + wrangler (code, secrets, D1 migrations) |

One Worker serves both the React static assets and the Hono API on the **same origin**
(no CORS). End-to-end type sharing between frontend and Worker (zod/shared types).

> Prices, free tiers, and model IDs in the design doc are 2026-06 research values.
> **Re-verify against official docs right before implementing anything that depends on them.**

---

## 3. Architecture — DDD with strict separation of concerns

We follow **Domain-Driven Design**. The dependency rule is absolute: **dependencies point
inward**. Domain knows nothing about Cloudflare, HTTP, or any library. Infrastructure
depends on domain, never the reverse.

### 3.1 Layers

```
interface/        HTTP boundary — Hono routes, middleware, auth guard,
                  request/response DTOs and validation (zod). No business logic.
application/      Use cases / orchestration — one class/function per use case
                  (IngestPaper, AnswerQuestion, GenerateSuggestions…). Depends on
                  domain + ports (interfaces). Transaction boundaries live here.
domain/           Entities, value objects, domain services, domain events, and
                  repository/port *interfaces*. Pure TypeScript, no I/O, no framework.
infrastructure/   Adapters that implement domain ports — Drizzle/D1 repositories,
                  R2 storage, Vectorize, Workers AI, AI Gateway clients, external
                  API clients (Semantic Scholar, arXiv, OpenAlex, Crossref).
shared/           Cross-cutting: Result/error types, ids, logging, config, env typing.
```

### 3.2 Bounded contexts

`identity` (auth/users/profile) · `ingestion` (normalize, extract, tag, foldering, embed) ·
`reading` (reflow view, explain-on-tap/selection) · `qa` (RAG: hybrid search → rerank →
grounded answer) · `suggestion` (external-API-grounded recommendations). Keep each
context's domain logic isolated; cross-context calls go through application services.

### 3.3 Rules

- Business rules live in `domain`/`application`, **never** in Hono handlers or in SQL.
- Talk to D1/R2/Vectorize/AI **only through repository/port interfaces** defined in `domain`
  and implemented in `infrastructure`. This keeps the search layer swappable (Vectorize ↔
  D1 brute force) and lets us unit-test without bindings.
- Return typed `Result`/errors from the domain; map to HTTP status only at the interface edge.
- Keep automated organization **non-destructive and reversible**: never overwrite a paper or
  folder the user moved manually; keep history.

---

## 4. Development Workflow

### 4.1 Branch per task

- **Never commit directly to `main`.** Start every new piece of work on a fresh branch off the
  latest `main`: `git switch -c <type>/<short-slug>` (e.g. `feat/ingestion-arxiv`,
  `fix/rag-rerank`, `chore/terraform-r2-state`).
- Keep branches focused and short-lived. One logical change per branch.
- If the repo is not yet a git repository, initialize it first (`git init`, first commit on
  `main`) before starting feature branches.

### 4.2 Quality gates — run before every push

Run the **full static-analysis suite** and make it green before pushing. Treat any failure as
blocking — fix the root cause, do not skip or disable checks.

```bash
npm run format       # formatter (write)
npm run lint         # linter (zero warnings)
npm run typecheck    # tsc --noEmit, strict
npm run test         # unit + integration (Vitest)
```

If these scripts don't exist yet, add them as part of scaffolding (Biome or ESLint+Prettier,
`tsc`, Vitest with `@cloudflare/vitest-pool-workers`). A single `npm run check` that chains
them all is encouraged.

### 4.3 Commit and push frequently

- Commit in small, coherent steps with clear messages (Conventional Commits:
  `feat:`, `fix:`, `chore:`, `refactor:`, `test:`, `docs:`).
- **Push after each meaningful, green change** — don't sit on large local-only history.
- End commit messages with the required trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`

### 4.4 Pull request, self-review, merge

- Open a PR per branch with a short summary of intent and the quality-gate results.
- **Self-review the full diff** before merging: re-read it, check the layering/dependency
  rule, security, and tests.
- After a clean self-review, you may merge with `gh pr merge --admin --squash` (admin merge is
  acceptable here — single-developer project). Prefer squash to keep `main` linear.
- Never merge a PR whose quality gates are red.

### 4.5 Setup / secrets / env

- Confirm or create only when asked; for anything outward-facing or hard to reverse, confirm
  first. Approval for one action does not extend to the next.
- The user may need to run interactive logins themselves — suggest typing `! <command>`
  (e.g. `! wrangler login`, `! gcloud auth login`) so output lands in the session.

---

## 5. Testing Strategy

Write **unit tests and integration tests**. **E2E is not required.**

- **Unit** — domain entities/value objects, domain services, and use cases with ports mocked.
  Fast, no bindings. This is where most business-rule coverage lives.
- **Integration** — Worker routes + infrastructure adapters against real bindings using
  `@cloudflare/vitest-pool-workers` (Miniflare): D1 queries with migrations applied, R2
  put/get, Vectorize/AI mocked or stubbed at the port. Cover the critical flows: ingestion
  pipeline, RAG search→rerank→answer, suggestion batch, auth guard + user-scoping.
- Cover **multi-tenancy invariants**: every query must filter by `user_id`; add tests proving
  cross-user data is never returned.
- New behavior ships with tests. Fix failing tests by fixing the cause, not by weakening them.

---

## 6. Cloudflare Best Practices

Defer to the Cloudflare skills (`cloudflare`, `workers-best-practices`, `wrangler`,
`durable-objects`, `agents-sdk`) and current docs over memory. Key conventions:

- **Stay inside the free-tier execution model.** Workers run on V8 isolates (TS/JS), 10ms CPU
  per request on free tier; I/O wait is not billed. Keep request handlers I/O-bound and light.
- **Offload work correctly:** post-response work via `ctx.waitUntil()` (≤30s); longer/independent
  jobs via **Queues** (producer in the request, consumer Worker); heavy PDF parsing via
  **Containers** only when cost demands it. Daily suggestions run on a **Cron Trigger** and
  cache to D1.
- **Parallel vs sequential:** independent tasks (per-paper ingest, embeddings, summaries) run in
  parallel; dependent steps stay sequential. Long summaries use map-reduce.
- **D1 is billed by rows scanned** and is single-threaded — **indexes are mandatory** on
  frequently filtered columns; never write an unindexed hot-path query.
- **R2 for anything read repeatedly** (PDFs) — egress is free.
- **Route all LLM calls through Cloudflare AI Gateway** (OpenAI-compatible base URL swap) to get
  response caching, cost/token analytics, rate limits, retries/fallback, and dollar spend limits
  in one place. Workers AI models are already Cloudflare-native.
- **Don't bundle in Terraform.** Terraform manages the resource graph (D1/R2/Vectorize/KV/Queues/
  Worker bindings/custom domain/DNS); **wrangler** builds & deploys code, applies D1 migrations,
  and sets secrets. Keep the boundary clean.
- Create the Better Auth instance **once per request** in middleware (double-creation causes
  503 / `waitUntil` contention). Enable `nodejs_compat`.
- Use exponential backoff on external APIs to avoid retry storms; respect polite rate limits
  (arXiv ~1 req/3s, Semantic Scholar 1 RPS with key).

---

## 7. Security

Security is a first-class concern on every change.

- **Tenant isolation is non-negotiable.** Every table has `user_id`; **every query forces a
  `user_id` filter**, including Vectorize searches (filter by `userId`, optionally `paperId`).
  There is no path that returns another user's data. Auth guard runs before every protected route.
- **Secrets never live in code or Terraform state.** Use `wrangler secret put` for
  `BETTER_AUTH_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `S2_API_KEY`, etc. Terraform references secret bindings only. Never log secret values.
- **Validate all input at the interface edge** with zod (uploaded PDFs, URLs, arXiv IDs, DOIs);
  reject/normalize before it reaches domain logic. Treat external API responses as untrusted.
- **Use stable identifiers for identity** (Google `sub`), not the mutable email.
- Set usage alerts and **AI Gateway spend limits**; on overage, block or fall back to a cheaper
  model rather than fail open on cost.
- Same-origin serving avoids CORS; if you ever add cross-origin, lock down allowed origins.
- Don't introduce destructive techniques, detection evasion, or anything outside authorized,
  defensive use. When a change touches auth, storage scoping, or secrets, call it out in the PR.

---

## 8. Frontend / UI

When building or changing UI, **use the `impeccable:frontend-design` skill** and aim for a
**refined, distinctive, production-grade interface** — avoid generic "AI default" aesthetics.

- The reading experience is the core: **reflow text is the star, original PDF is the
  understudy** (one-tap toggle). Interactions (explain-on-selection / explain-on-tap of a
  paragraph, figure, or formula) happen on the **stable text layer**, not raw PDF.
- Desktop: text selection → popover. Mobile: paragraph/figure/formula tap. The app is
  responsive web (no native app); design mobile-first for precise vs. coarse pointers.
- Always keep the **original PDF one tap away**, and show **source spans (section/page)** on
  answers, explanations, and summaries so the user can verify.
- AI-generated output (summary/explanation/answer) is language-switchable (ja/en); originals
  are never translated. Keep copy clear (consider `impeccable:clarify`/`polish` passes).
- Complement with `impeccable:audit`/`polish` before shipping notable UI.

---

## 9. AI / LLM Conventions

- **Model cascade — cheap filters, careful final calls.** Extraction/tagging/foldering on
  Gemini Flash-Lite; summaries on Flash; drag-explain on a GPT-mini; real Q&A on GPT-mid;
  escalate to flagship only when needed. See the table in the design doc §4.6.
- **RAG is two-stage:** hybrid retrieval (dense `bge-m3` + keyword) pulling 30–50 candidates →
  `bge-reranker-base` → top ~5 → grounded answer. **Answer only from retrieved chunks**, cite
  source spans, and say "not found" when there's no basis. The reranker is the biggest lever.
- **Ground facts in real data, personalize with the LLM.** Suggestions are sourced from real
  APIs (Semantic Scholar / arXiv / OpenAlex); the LLM only ranks and explains. Never let the
  LLM invent papers.
- **Don't recompute:** prompt caching (system prompt + paper context), AI Gateway response
  cache, D1-cached suggestions, embeddings generated once. Use Batch API (≈50% off) for daily
  suggestions and bulk re-embedding.
- **Extraction quality caps everything downstream.** Prefer the best source form: arXiv HTML
  (MathML) > text layer + multimodal LLM for formulas/tables > multimodal OCR for scans. Pull
  metadata/references from structured external APIs, not PDF parsing.

For Anthropic/Claude API work, consult the `claude-api` skill rather than relying on memory.

---

## 10. Data & Infrastructure Notes

- **Data model:** Better Auth tables (`user`/`session`/`account`/…) plus app tables
  (`profile`, `paper`, `folder`, `tag`/`paper_tag`, `chunk`, `note`, `suggestion`,
  `qa_message`). All carry `user_id`; index hot filter columns. See design doc §6 for the full
  sketch. Each paper has one "home folder" + multiple tags.
- **R2 layout:** `pdf/{userId}/{paperId}.pdf`, `text/{userId}/{paperId}.json`,
  `fig/{userId}/{paperId}/{n}.png`.
- **Migrations:** Drizzle Kit + `wrangler d1 migrations apply` (local/remote). Never edit a
  shipped migration; add a new one.
- **Terraform state lives in R2** (S3-compatible), never local-only. Plan/review before apply.
- **One-time manual bootstrap (documented exception):** the Google "Sign in with Google" OAuth
  client + consent screen are created once by hand in the Google console (no Terraform resource
  exists for it); redirect URI `https://eyday-paper.yoshidakazuya.com/api/auth/callback/google`.
  Store issued credentials via `wrangler secret`.

---

## 11. Working Principles (carry-over from the design doc)

- Judge every decision by whether it serves the axis: **lowering the barrier to reading.**
- **YAGNI**, but install the seams that get expensive later (user boundary).
- Don't fight the platform's native execution model; align the stack to the core library's
  language; optimize the *actual* bottleneck (this app is I/O-bound).
- Automation must respect manual user actions and stay reversible.
- Keep verifiability for everything automated (original one tap away + cited source spans).
- Keep infra declarative (Terraform) and fast-moving code/schema in dedicated tools (wrangler);
  keep the boundary clean and **secrets out of IaC state**.

---

## 12. Quick Checklist Before You Push

0. Re-read the relevant section(s) of [`specs/design doc.md`](specs/design%20doc.md); the change
   follows it (and the doc is updated in this PR if the change outdates it).
1. On a dedicated branch off `main` (not on `main` itself).
2. Dependency rule respected — domain has no framework/IO imports.
3. Every new query filters by `user_id`; secrets not hardcoded.
4. `format` → `lint` → `typecheck` → `test` all green.
5. Unit + integration tests added/updated for the change.
6. Re-verified any price/free-tier/model-ID assumption against official docs.
7. Committed with the `Co-Authored-By` trailer and pushed.
8. PR opened, diff self-reviewed; merge `--admin` only after a clean review.
