# infra/ — Terraform (Cloudflare resource graph)

Terraform owns the **stateful resource graph**; `wrangler` builds/deploys the
Worker code, applies D1 migrations, and sets secrets. Boundaries stay clean and
**no secret ever lives in Terraform state**.

## Managed here

- `cloudflare_d1_database` — relational data (Better Auth + app tables)
- `cloudflare_r2_bucket` — PDFs / extracted text / figures
- `cloudflare_workers_kv_namespace` — cache
- `cloudflare_queue` — async ingestion/embedding jobs
- `cloudflare_workers_custom_domain` — routes `eyday-paper.yoshidakazuya.com` to the Worker

## NOT managed here (documented exceptions)

- **Vectorize index** — the provider has no `cloudflare_vectorize_index`. Create once:
  ```sh
  wrangler vectorize create eyday-paper-chunks --dimensions=1024 --metric=cosine
  ```
  (1024 = bge-m3 dense dimensionality.)
- **Worker script + bindings** — deployed by `wrangler deploy` (Terraform doesn't bundle).
- **Secrets** — `wrangler secret put …` (see repo root). Never in `.tf` / state.
- **Google OAuth client** — created once by hand in the Google console (design doc §インフラ管理).

## Offline schema check (no credentials)

```sh
terraform -chdir=infra init -backend=false
terraform -chdir=infra validate
```

## Real apply (requires your Cloudflare credentials)

1. Export `CLOUDFLARE_API_TOKEN` (Workers/D1/R2/KV/Queues/DNS edit scopes).
2. Create the R2 state bucket once (`wrangler r2 bucket create eyday-paper-tfstate`).
3. `cp terraform.tfvars.example terraform.tfvars` and fill `account_id` / `zone_id`.
4. Init with the R2 (S3-compatible) backend:
   ```sh
   terraform -chdir=infra init \
     -backend-config="endpoints={s3=\"https://<ACCOUNT_ID>.r2.cloudflarestorage.com\"}" \
     -backend-config="access_key=$R2_ACCESS_KEY_ID" \
     -backend-config="secret_key=$R2_SECRET_ACCESS_KEY"
   ```
5. `terraform -chdir=infra plan` → review → `terraform -chdir=infra apply`.
6. Copy outputs (`d1_database_id`, `kv_namespace_id`, …) into `wrangler.jsonc`.
