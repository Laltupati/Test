variable "resource_group_name" {
  description = "The name of the Azure Resource Group"
  type        = string
  default     = "rg-qualiverse-prod"
}

variable "location" {
  description = "Azure region for primary infrastructure"
  type        = string
  default     = "eastus"
}

variable "environment" {
  description = "Deployment environment name (production, staging)"
  type        = string
  default     = "production"
}

variable "db_admin_username" {
  description = "Administrator username for Azure Database for PostgreSQL"
  type        = string
  default     = "qvadmin"
}

variable "db_admin_password" {
  description = "Administrator password for Azure Database for PostgreSQL"
  type        = string
  sensitive   = true
}

variable "db_sku_name" {
  description = "SKU for PostgreSQL Flexible Server"
  type        = string
  default     = "B_Standard_B1ms" # Burstable 1 core, 2GB RAM (cost-effective) or "GP_Standard_D2ds_v5" for production
}

variable "jwt_secret" {
  description = "Secret key for JWT token signing"
  type        = string
  sensitive   = true
}

variable "tags" {
  description = "Tags to apply to all Azure resources"
  type        = map(string)
  default = {
    Project     = "QualiVerse-AI"
    ManagedBy   = "Terraform"
    Environment = "Production"
  }
}

variable "app_service_sku" {
  description = "Linux App Service Plan SKU. Use B1 for development and P1v3 or higher for production workloads."
  type        = string
  default     = "B1"
}
