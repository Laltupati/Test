variable "project_id" {
  description = "The Google Cloud Project ID"
  type        = string
  default     = "adv-lighthouse-ai-qa-agent"
}

variable "region" {
  description = "GCP Region for Cloud Run & Artifact Registry"
  type        = string
  default     = "us-central1"
}

variable "environment" {
  description = "Environment name (production, staging)"
  type        = string
  default     = "production"
}

variable "jwt_secret" {
  description = "JWT Secret for Authentication"
  type        = string
  sensitive   = true
  default     = "qualiverse-gcp-production-secret-change-me"
}

variable "custom_domain" {
  description = "Enterprise Custom Domain for Cloud Run Mapping (e.g. qualiverse.kpmg.com or qualiverse.ai)"
  type        = string
  default     = ""
}

variable "enable_cloud_armor" {
  description = "Whether to provision Cloud Armor WAF security policy"
  type        = bool
  default     = true
}
