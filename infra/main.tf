# Resource graph for eyday-paper. Terraform owns stateful resources; wrangler
# builds/deploys the Worker code, applies D1 migrations, and sets secrets.
# Secrets are NEVER defined here (kept out of TF state) — see infra/README.md.

# Relational data: Better Auth tables + app tables.
resource "cloudflare_d1_database" "main" {
  account_id = var.account_id
  name       = var.name_prefix
}

# Object storage: PDFs, extracted structured text, figures (egress-free).
resource "cloudflare_r2_bucket" "main" {
  account_id = var.account_id
  name       = var.name_prefix
}

# Cache namespace (cheap repeated lookups / suggestion cache helpers).
resource "cloudflare_workers_kv_namespace" "main" {
  account_id = var.account_id
  title      = "${var.name_prefix}-kv"
}

# RAG vector search index — NOT a Terraform resource: the Cloudflare provider
# has no `cloudflare_vectorize_index`. Created once via wrangler (documented
# exception, like the Google OAuth client):
#   wrangler vectorize create eyday-paper-chunks --dimensions=1024 --metric=cosine
# (bge-m3 dense vectors are 1024-d.) See infra/README.md.

# Async ingestion / embedding job queue.
resource "cloudflare_queue" "ingest" {
  account_id = var.account_id
  queue_name = "${var.name_prefix}-ingest"
}

# Route the production hostname to the Worker (the script itself is deployed by
# wrangler; this binds the custom domain). Creates the proxied DNS record too.
resource "cloudflare_workers_custom_domain" "main" {
  account_id = var.account_id
  zone_id    = var.zone_id
  hostname   = var.domain
  service    = var.name_prefix
}
