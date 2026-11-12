output "resource_group_name" {
  description = "The Azure Resource Group name"
  value       = azurerm_resource_group.rg.name
}

output "postgres_fqdn" {
  description = "Fully qualified domain name of Azure PostgreSQL Flexible Server"
  value       = azurerm_postgresql_flexible_server.postgres.fqdn
}

output "backend_api_url" {
  description = "The public HTTPS URL for the backend FastAPI Linux Web App"
  value       = "https://${azurerm_linux_web_app.backend_api.default_hostname}"
}

output "backend_web_app_name" {
  description = "Azure Linux Web App name hosting the FastAPI backend"
  value       = azurerm_linux_web_app.backend_api.name
}

output "frontend_static_web_app_url" {
  description = "The public HTTPS URL for the frontend Azure Static Web App"
  value       = "https://${azurerm_static_site.frontend.default_host_name}"
}

output "static_web_app_api_key" {
  description = "Deployment token for Azure Static Web Apps (use in CI/CD pipeline)"
  value       = azurerm_static_site.frontend.api_key
  sensitive   = true
}
