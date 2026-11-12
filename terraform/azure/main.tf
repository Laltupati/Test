terraform {
  required_version = ">= 1.3.0"
  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 3.90"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }
}

provider "azurerm" {
  features {
    key_vault {
      purge_soft_delete_on_destroy    = true
      recover_soft_deleted_key_vaults = true
    }
  }
}

resource "random_string" "suffix" {
  length  = 6
  special = false
  upper   = false
}

# 1. Resource Group
resource "azurerm_resource_group" "rg" {
  name     = var.resource_group_name
  location = var.location
  tags     = var.tags
}

# 2. Linux App Service Plan for the FastAPI backend
resource "azurerm_service_plan" "backend_plan" {
  name                = "asp-qualiverse-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  os_type             = "Linux"
  sku_name            = var.app_service_sku
  tags                = var.tags
}

# 3. Azure Database for PostgreSQL Flexible Server
resource "azurerm_postgresql_flexible_server" "postgres" {
  name                   = "psql-qualiverse-${random_string.suffix.result}"
  resource_group_name    = azurerm_resource_group.rg.name
  location               = azurerm_resource_group.rg.location
  version                = "15"
  administrator_login    = var.db_admin_username
  administrator_password = var.db_admin_password
  zone                   = "1"

  storage_mb   = 32768
  sku_name     = var.db_sku_name

  backup_retention_days        = 7
  geo_redundant_backup_enabled = false
  tags                         = var.tags
}

# PostgreSQL Database
resource "azurerm_postgresql_flexible_server_database" "qualiverse_db" {
  name      = "qualiverse_db"
  server_id = azurerm_postgresql_flexible_server.postgres.id
  collation = "en_US.utf8"
  charset   = "utf8"
}

# Allow Azure Services to Access PostgreSQL
resource "azurerm_postgresql_flexible_server_firewall_rule" "allow_azure_services" {
  name             = "AllowAllAzureServices"
  server_id        = azurerm_postgresql_flexible_server.postgres.id
  start_ip_address = "0.0.0.0"
  end_ip_address   = "0.0.0.0"
}

# 4. Linux Web App hosting the FastAPI backend
resource "azurerm_linux_web_app" "backend_api" {
  name                = "app-qualiverse-api-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = azurerm_resource_group.rg.location
  service_plan_id     = azurerm_service_plan.backend_plan.id
  https_only          = true

  identity {
    type = "SystemAssigned"
  }

  site_config {
    always_on         = true
    minimum_tls_version = "1.2"
    ftps_state        = "Disabled"
    health_check_path = "/health"
    app_command_line  = "gunicorn --bind=0.0.0.0:8000 --workers 2 --worker-class uvicorn.workers.UvicornWorker --timeout 120 app.main:app"

    application_stack {
      python_version = "3.11"
    }
  }

  app_settings = {
    "ENVIRONMENT"                     = var.environment
    "PORT"                            = "8000"
    "SCM_DO_BUILD_DURING_DEPLOYMENT"  = "true"
    "ENABLE_ORYX_BUILD"               = "true"
    "WEBSITE_HTTPLOGGING_ENABLED"     = "1"
    "DATABASE_URL"                    = "postgresql+psycopg2://${var.db_admin_username}:${var.db_admin_password}@${azurerm_postgresql_flexible_server.postgres.fqdn}:5432/qualiverse_db?sslmode=require"
    "USE_FIRESTORE"                   = "false"
    "JWT_SECRET"                      = var.jwt_secret
    "JWT_ALGORITHM"                   = "HS256"
    "JWT_ACCESS_TOKEN_EXPIRE_MINUTES" = "1440"
    "CORS_ORIGINS"                    = jsonencode(["https://${azurerm_static_site.frontend.default_host_name}"])
  }

  logs {
    detailed_error_messages = true
    failed_request_tracing  = true
    application_logs {
      file_system_level = "Information"
    }
    http_logs {
      file_system {
        retention_in_days = 7
        retention_in_mb   = 50
      }
    }
  }

  tags = var.tags

  depends_on = [
    azurerm_postgresql_flexible_server_database.qualiverse_db,
    azurerm_postgresql_flexible_server_firewall_rule.allow_azure_services
  ]
}

# 6. Azure Static Web Apps (Frontend React SPA)
resource "azurerm_static_site" "frontend" {
  name                = "swa-qualiverse-frontend-${random_string.suffix.result}"
  resource_group_name = azurerm_resource_group.rg.name
  location            = "eastus2" # SWA is supported in specific global regions (eastus2, centralus, westus2, westeurope, etc.)
  sku_tier            = "Standard"
  sku_size            = "Standard"
  tags                = var.tags
}
