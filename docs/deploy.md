# Deploy runbook

Terraform owns the stateful resource graph; **wrangler** builds/deploys the Worker
code, applies D1 migrations, creates the Vectorize index, and sets secrets. No
secret ever lives in code or Terraform state.

## 0. Prerequisites (your action)
- `wrangler login` (or `CLOUDFLARE_API_TOKEN`), a Cloudflare account, and the
  `yoshidakazuya.com` zone on Cloudflare.
- Google OAuth client created — see [oauth-bootstrap.md](./oauth-bootstrap.md).

## 1. Provision resources (Terraform)
```sh
wrangler r2 bucket create eyday-paper-tfstate          # one-time state bucket
terraform -chdir=infra init \
  -backend-config="endpoints={s3=\"https://<ACCOUNT_ID>.r2.cloudflarestorage.com\"}" \
  -backend-config="access_key=$R2_ACCESS_KEY_ID" \
  -backend-config="secret_key=$R2_SECRET_ACCESS_KEY"
cp infra/terraform.tfvars.example infra/terraform.tfvars   # fill account_id, zone_id
terraform -chdir=infra plan       # review
terraform -chdir=infra apply
```
Copy the outputs (`d1_database_id`, `kv_namespace_id`, …) into `wrangler.jsonc`.

## 2. Vectorize index (wrangler — no Terraform resource exists)
```sh
wrangler vectorize create eyday-paper-chunks --dimensions=1024 --metric=cosine
wrangler vectorize create-metadata-index eyday-paper-chunks --property-name=userId --type=string
wrangler vectorize create-metadata-index eyday-paper-chunks --property-name=paperId --type=string
```

## 3. AI Gateway
Create a gateway named `eyday-paper` in the Cloudflare dashboard (AI → AI Gateway).
Set a **dollar spend limit** and turn on caching. Note your account id and gateway
name (used by `CF_ACCOUNT_ID` / `AI_GATEWAY_NAME`). Verify the provider base-URL
paths in `src/infrastructure/ai/ai-gateway.ts` against current AI Gateway docs.

## 4. Secrets (wrangler)
```sh
wrangler secret put BETTER_AUTH_SECRET
wrangler secret put BETTER_AUTH_URL          # https://eyday-paper.yoshidakazuya.com
wrangler secret put GOOGLE_CLIENT_ID
wrangler secret put GOOGLE_CLIENT_SECRET
wrangler secret put CF_ACCOUNT_ID
wrangler secret put AI_GATEWAY_NAME          # eyday-paper
wrangler secret put OPENAI_API_KEY
wrangler secret put GEMINI_API_KEY
wrangler secret put S2_API_KEY               # optional (Semantic Scholar)
```

## 5. Migrate + deploy
```sh
npm run check                 # format/lint/typecheck/depcruise/test must be green
npm run db:migrate:remote     # wrangler d1 migrations apply eyday-paper --remote
npm run build                 # vite build (client + worker)
npm run deploy                # wrangler deploy -c dist/eyday_paper/wrangler.json (worker + client assets)
```

## 6. Smoke test
Visit `https://eyday-paper.yoshidakazuya.com`, sign in with Google, ingest an arXiv
id (e.g. `1706.03762`), open the reader (reflow + PDF toggle), generate a summary,
ask a question, and check **提案** after the daily cron (or POST `/api/suggestions/refresh`).
Watch cost/usage in the AI Gateway dashboard.

## 7. CI/CD — auto-deploy on push to `main`

`.github/workflows/deploy.yml` runs on every push to `main` (and via manual
**Run workflow**): `npm run check` → `db:migrate:remote` → `npm run build` →
`npm run deploy` (`wrangler deploy -c dist/eyday_paper/wrangler.json`). Cron
triggers and bindings in `wrangler.jsonc` are registered by the deploy.

**One-time GitHub setup** (repo → Settings → Secrets and variables → Actions):
- `CLOUDFLARE_API_TOKEN` — token with **Workers Scripts: Edit**, **D1: Edit**, and
  account read (Account → Workers AI/KV/R2/Vectorize as needed). Create at
  Cloudflare dashboard → My Profile → API Tokens.
- `CLOUDFLARE_ACCOUNT_ID` — the account id (same as `CF_ACCOUNT_ID`).

App secrets (`BETTER_AUTH_SECRET`, `GOOGLE_*`, `OPENAI_API_KEY`, …) are **not** part
of CI — they persist on the Worker from the one-time `wrangler secret put` (step 4),
so a code deploy keeps them. Rotate them with `wrangler secret put`, never in CI.
Provisioning (Terraform, Vectorize, AI Gateway) stays manual (steps 1–3).
