# Automated Microsoft Azure Deployment Script for QualiVerse AI
[CmdletBinding()]
param (
    [string]$ResourceGroupName = "rg-qualiverse-prod",
    [string]$Location = "eastus",
    [string]$SubscriptionId = ""
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "     QualiVerse AI Azure Deploy         " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Resource Group: $ResourceGroupName" -ForegroundColor Gray
Write-Host "Location:       $Location" -ForegroundColor Gray
Write-Host ""

# 1. Check Azure CLI
Write-Host "[1/6] Checking Azure CLI..." -ForegroundColor Yellow
$azCli = Get-Command az -ErrorAction SilentlyContinue
if (-not $azCli) {
    Write-Host "Error: Azure CLI (az) is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install Azure CLI from https://aka.ms/installazurecliwindows" -ForegroundColor Red
    exit 1
}

# 2. Select Subscription (if provided)
if ($SubscriptionId -ne "") {
    Write-Host "`n[2/6] Setting Azure Subscription..." -ForegroundColor Yellow
    az account set --subscription $SubscriptionId
} else {
    Write-Host "`n[2/6] Using current active Azure Subscription..." -ForegroundColor Yellow
}

# 3. Create Resource Group
Write-Host "`n[3/6] Ensuring Resource Group exists..." -ForegroundColor Yellow
az group create --name $ResourceGroupName --location $Location --output none

# 4. Deploy Infrastructure via Terraform
Write-Host "`n[4/6] Initializing and Applying Azure Terraform..." -ForegroundColor Yellow
Push-Location terraform/azure
try {
    terraform init -input=false
    terraform apply -auto-approve -var="resource_group_name=$ResourceGroupName" -var="location=$Location"
    $backendUrl = terraform output -raw backend_api_url
    $frontendUrl = terraform output -raw frontend_static_web_app_url
    $acrServer = terraform output -raw acr_login_server
} finally {
    Pop-Location
}

# 5. Build and Push Backend Docker Image
Write-Host "`n[5/6] Building and Pushing Backend Docker Image..." -ForegroundColor Yellow
az acr login --name $acrServer.Split('.')[0]
docker build -t "$acrServer/qualiverse-backend:latest" -f backend/Dockerfile backend
docker push "$acrServer/qualiverse-backend:latest"

# 6. Build and Deploy Frontend
Write-Host "`n[6/6] Building Frontend with Production Backend URL..." -ForegroundColor Yellow
Push-Location frontend
try {
    $env:VITE_API_BASE_URL = "$backendUrl/api/v1"
    npm ci
    npm run build
} finally {
    Pop-Location
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   Azure Deployment Completed Successfully! " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Frontend SWA URL: $frontendUrl" -ForegroundColor Cyan
Write-Host "Backend API URL:  $backendUrl" -ForegroundColor Cyan
Write-Host "Backend Health:   $backendUrl/health" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
