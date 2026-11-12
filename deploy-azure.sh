#!/bin/bash
# Automated Microsoft Azure Deployment Script for QualiVerse AI
set -e

RESOURCE_GROUP=${1:-"rg-qualiverse-prod"}
LOCATION=${2:-"eastus"}

echo "========================================"
echo "     QualiVerse AI Azure Deploy         "
echo "========================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location:       $LOCATION"
echo ""

# 1. Check Azure CLI
echo "[1/6] Checking Azure CLI..."
if ! command -v az &> /dev/null; then
    echo "Error: Azure CLI (az) is not installed."
    echo "Please install Azure CLI from https://docs.microsoft.com/en-us/cli/azure/install-azure-cli"
    exit 1
fi

# 2. Check Terraform
echo "[2/6] Checking Terraform..."
if ! command -v terraform &> /dev/null; then
    echo "Error: Terraform is not installed."
    echo "Please install Terraform from https://developer.hashicorp.com/terraform/downloads"
    exit 1
fi

# 3. Create Resource Group
echo "[3/6] Ensuring Resource Group exists..."
az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none

# 4. Provision Infrastructure
echo "[4/6] Provisioning Azure Infrastructure via Terraform..."
cd terraform/azure
terraform init -input=false
terraform apply -auto-approve -var="resource_group_name=$RESOURCE_GROUP" -var="location=$LOCATION"

BACKEND_URL=$(terraform output -raw backend_api_url)
FRONTEND_URL=$(terraform output -raw frontend_static_web_app_url)
ACR_SERVER=$(terraform output -raw acr_login_server)
cd ../..

# 5. Build and Push Backend Docker Image
echo "[5/6] Building & Pushing Backend Image to ACR..."
ACR_NAME=$(echo "$ACR_SERVER" | cut -d'.' -f1)
az acr login --name "$ACR_NAME"
docker build -t "$ACR_SERVER/qualiverse-backend:latest" -f backend/Dockerfile backend
docker push "$ACR_SERVER/qualiverse-backend:latest"

# 6. Build Frontend
echo "[6/6] Building Frontend SPA..."
cd frontend
export VITE_API_BASE_URL="$BACKEND_URL/api/v1"
npm ci
npm run build
cd ..

echo ""
echo "========================================"
echo "   Azure Deployment Completed Successfully! "
echo "========================================"
echo "Frontend URL:  $FRONTEND_URL"
echo "Backend URL:   $BACKEND_URL"
echo "Health Check:  $BACKEND_URL/health"
echo "========================================"
