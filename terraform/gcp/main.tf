terraform {
  required_version = ">= 1.3.0"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# 1. Enable Required GCP APIs
resource "google_project_service" "apis" {
  for_each = toset([
    "run.googleapis.com",
    "firestore.googleapis.com",
    "artifactregistry.googleapis.com",
    "cloudbuild.googleapis.com",
    "iam.googleapis.com"
  ])
  service            = each.key
  disable_on_destroy = false
}

# 2. Firestore Native Database
resource "google_firestore_database" "database" {
  project     = var.project_id
  name        = "qualiverse-db"
  location_id = var.region
  type        = "FIRESTORE_NATIVE"

  depends_on = [google_project_service.apis]
}

# 3. Artifact Registry Docker Repository
resource "google_artifact_registry_repository" "repo" {
  location      = var.region
  repository_id = "qualiverse-repo"
  description   = "Docker repository for QualiVerse AI services"
  format        = "DOCKER"

  depends_on = [google_project_service.apis]
}

# 4. Service Account for Cloud Run
resource "google_service_account" "qualiverse_sa" {
  account_id   = "qualiverse-cloudrun-sa"
  display_name = "QualiVerse Cloud Run Service Account"
}

# Grant Firestore User Role to Service Account
resource "google_project_iam_member" "firestore_user" {
  project = var.project_id
  role    = "roles/datastore.user"
  member  = "serviceAccount:${google_service_account.qualiverse_sa.email}"
}

# 5. Cloud Run Service: Single Application Service (API + Frontend)
resource "google_cloud_run_v2_service" "app" {
  name     = "qualiverse"
  location = var.region
  ingress  = "INGRESS_TRAFFIC_ALL"

  template {
    service_account = google_service_account.qualiverse_sa.email

    containers {
      image = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}/qualiverse:latest"

      env {
        name  = "ENVIRONMENT"
        value = var.environment
      }
      env {
        name  = "USE_FIRESTORE"
        value = "true"
      }
      env {
        name  = "GCP_PROJECT_ID"
        value = var.project_id
      }
      env {
        name  = "FIRESTORE_DATABASE"
        value = "qualiverse-db"
      }
      env {
        name  = "JWT_SECRET"
        value = var.jwt_secret
      }

      resources {
        limits = {
          cpu    = "1000m"
          memory = "512Mi"
        }
      }
    }
  }

  depends_on = [google_firestore_database.database]
}

# Allow Unauthenticated Public Access
resource "google_cloud_run_service_iam_member" "app_public" {
  location = google_cloud_run_v2_service.app.location
  service  = google_cloud_run_v2_service.app.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# 6. Enterprise Cloud Armor WAF Policy
resource "google_compute_security_policy" "cloud_armor_policy" {
  count       = var.enable_cloud_armor ? 1 : 0
  name        = "qualiverse-waf-policy"
  description = "Enterprise WAF and DDoS security policy for QualiVerse AI"

  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow all rule"
  }
}

# 7. Optional Custom Domain Mapping
resource "google_cloud_run_domain_mapping" "custom_domain" {
  count    = var.custom_domain != "" ? 1 : 0
  location = var.region
  name     = var.custom_domain

  metadata {
    namespace = var.project_id
  }

  spec {
    route_name = google_cloud_run_v2_service.app.name
  }
}
