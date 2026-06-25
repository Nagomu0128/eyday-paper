# IDs/names consumed by wrangler.jsonc (D1 database_id, KV id, etc.). After
# `terraform apply`, copy these into wrangler.jsonc / deploy config.
output "d1_database_id" {
  value       = cloudflare_d1_database.main.id
  description = "Set as d1_databases[].database_id in wrangler.jsonc."
}

output "r2_bucket_name" {
  value       = cloudflare_r2_bucket.main.name
  description = "Set as r2_buckets[].bucket_name in wrangler.jsonc."
}

output "kv_namespace_id" {
  value       = cloudflare_workers_kv_namespace.main.id
  description = "Set as kv_namespaces[].id in wrangler.jsonc."
}

output "queue_name" {
  value       = cloudflare_queue.ingest.queue_name
  description = "Set as queues.producers[].queue in wrangler.jsonc."
}
