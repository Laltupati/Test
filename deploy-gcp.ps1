# Automated Google Cloud Deployment Script for QualiVerse AI
[CmdletBinding()]
param (
    [string]$ProjectId = "adv-lighthouse-ai-qa-agent",
    [string]$Region = "us-central1"
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "   QualiVerse AI Google Cloud Deploy    " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Project ID: $ProjectId" -ForegroundColor Gray
Write-Host "Region:     $Region" -ForegroundColor Gray
Write-Host ""

# 1. Check gcloud CLI
Write-Host "[1/6] Checking gcloud CLI..." -ForegroundColor Yellow
$gcloud = Get-Command gcloud -ErrorAction SilentlyContinue
if (-not $gcloud) {
    Write-Host "Error: Google Cloud SDK (gcloud) is not installed or not in PATH." -ForegroundColor Red
    Write-Host "Please install gcloud CLI from https://cloud.google.com/sdk" -ForegroundColor Red
    exit 1
}

# 2. Set Active GCP Project
Write-Host "`n[2/6] Configuring GCP Project..." -ForegroundColor Yellow
gcloud config set project $ProjectId

# 3. Enable Required GCP APIs
Write-Host "`n[3/6] Enabling Google Cloud Services..." -ForegroundColor Yellow
gcloud services enable run.googleapis.com firestore.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --async

# 4. Create Artifact Registry Repository (if not exists)
Write-Host "`n[4/6] Setting up Artifact Registry..." -ForegroundColor Yellow
$repoCheck = & gcloud artifacts repositories describe qualiverse-repo --location=$Region --format="value(name)" 2>$null
if (-not $repoCheck) {
    Write-Host "Creating Artifact Registry Docker Repository..." -ForegroundColor Gray
    & gcloud artifacts repositories create qualiverse-repo --repository-format=docker --location=$Region --description="QualiVerse AI Repository"
} else {
    Write-Host "Artifact Registry repository 'qualiverse-repo' ready." -ForegroundColor Gray
}

# Configure Docker Authentication
gcloud auth configure-docker "$Region-docker.pkg.dev" --quiet

# 5. Build and Deploy Single Container App
$repoUri = "$Region-docker.pkg.dev/$ProjectId/qualiverse-repo"

Write-Host "`n[5/6] Deploying Application via Cloud Build..." -ForegroundColor Yellow
gcloud builds submit --config cloudbuild.yaml

$appUrl = gcloud run services describe qualiverse --region $Region --format="value(status.url)"

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "   GCP Deployment Completed Successfully! " -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host "Application URL: $appUrl" -ForegroundColor Cyan
Write-Host "API Health Check: $appUrl/health" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Green
