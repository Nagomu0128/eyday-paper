terraform {
  # Terraform state lives in R2 (S3-compatible), never local-only. Account-specific
  # values (the R2 endpoint + access keys) are supplied at init via -backend-config
  # and are NEVER committed. For offline schema checks use:
  #   terraform init -backend=false && terraform validate
  backend "s3" {
    bucket = "eyday-paper-tfstate"
    key    = "eyday-paper/terraform.tfstate"
    region = "auto"

    # R2 is not real AWS S3; relax the AWS-specific behaviours.
    skip_credentials_validation = true
    skip_region_validation      = true
    skip_requesting_account_id  = true
    skip_metadata_api_check     = true
    skip_s3_checksum            = true
    use_path_style              = true
  }
}
