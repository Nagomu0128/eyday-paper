variable "account_id" {
  type        = string
  description = "Cloudflare account ID that owns these resources."
}

variable "zone_id" {
  type        = string
  description = "Cloudflare zone ID for yoshidakazuya.com (custom domain routing)."
}

variable "domain" {
  type        = string
  description = "Public hostname the Worker is served on."
  default     = "eyday-paper.yoshidakazuya.com"
}

variable "name_prefix" {
  type        = string
  description = "Base name for all resources (Worker, D1, R2, etc.)."
  default     = "eyday-paper"
}

variable "vectorize_dimensions" {
  type        = number
  description = "Embedding dimensionality. bge-m3 dense vectors are 1024-d."
  default     = 1024
}
