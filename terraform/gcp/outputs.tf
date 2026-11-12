output "firestore_database" {
  description = "The Firestore database ID"
  value       = google_firestore_database.database.name
}

output "artifact_registry_repository" {
  description = "The Artifact Registry Docker Repository URI"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.repo.repository_id}"
}

output "app_url" {
  description = "The Cloud Run URL for the QualiVerse AI Application"
  value       = google_cloud_run_v2_service.app.uri
}

output "custom_domain_dns_records" {
  description = "DNS records required if Custom Domain mapping is enabled"
  value       = length(google_cloud_run_domain_mapping.custom_domain) > 0 ? google_cloud_run_domain_mapping.custom_domain[0].status[0].resource_records : []
}
