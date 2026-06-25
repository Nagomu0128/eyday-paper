terraform {
  required_version = ">= 1.9.0"

  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "~> 5.0"
    }
  }
}

# Provider auth comes from CLOUDFLARE_API_TOKEN (never hard-coded, never in state).
provider "cloudflare" {}
