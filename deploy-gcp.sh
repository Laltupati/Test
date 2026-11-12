#!/bin/bash
# Automated Google Cloud Deployment Script for QualiVerse AI
set -e

PROJECT_ID=${1:-"adv-lighthouse-ai-qa-agent"}
REGION=${2:-"us-central1"}

if [ -z "$PROJECT_ID" ]; then
    echo "Usage: ./deploy-gcp.sh <PROJECT_ID> [REGION]"
    exit 1
fi

echo "========================================"
echo "   QualiVerse AI Google Cloud Deploy    "
echo "========================================"
echo "Project ID: $PROJECT_ID"
echo "Region:     $REGION"
echo ""

# 1. Check gcloud CLI
echo "[1/6] Checking gcloud CLI..."
if ! command -v gcloud &> /dev/null; then
    echo "Error: Google Cloud SDK (gcloud) is not installed."
    exit 1
fi

# 2. Configure GCP Project
echo "[2/6] Configuring GCP Project..."
gcloud config set project "$PROJECT_ID"

# 3. Enable Required GCP APIs
echo "[3/6] Enabling Google Cloud Services..."
gcloud services enable run.googleapis.com firestore.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com

# 4. Create Artifact Registry Repository
echo "[4/6] Setting up Artifact Registry..."
if ! gcloud artifacts repositories describe qualiverse-repo --location="$REGION" &> /dev/null; then
    gcloud artifacts repositories create qualiverse-repo --repository-format=docker --location="$REGION" --description="QualiVerse AI Repository"
fi
gcloud auth configure-docker "$REGION-docker.pkg.dev" --quiet

# 5. Build and Deploy Application
echo "[5/5] Deploying Application via Cloud Build..."
gcloud builds submit --config cloudbuild.yaml

APP_URL=$(gcloud run services describe qualiverse --region "$REGION" --format="value(status.url)")

echo ""
echo "========================================"
echo "   GCP Deployment Completed Successfully! "
echo "========================================"
echo "Application URL:  $APP_URL"
echo "API Health Check: $APP_URL/health"
echo "========================================"
