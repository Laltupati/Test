# Google Cloud Platform (GCP) Deployment

QualiVerse AI is configured for enterprise deployment on **Google Cloud Run** connected to a dedicated **Google Cloud Firestore Native** database (`qualiverse-db`).

---

## 📍 Deployment Target Specifications

| Parameter | Value |
| :--- | :--- |
| **GCP Project ID** | `adv-lighthouse-ai-qa-agent` |
| **Region** | `us-central1` |
| **Firestore Database ID** | `qualiverse-db` |
| **Artifact Registry Repo** | `qualiverse-repo` |
| **Cloud Run Service** | `qualiverse` |
| **Cloud Run Seed Job** | `qualiverse-seed` |
| **Default App Target URL** | [https://qualiverse-m3nwxpgwpa-uc.a.run.app](https://qualiverse-m3nwxpgwpa-uc.a.run.app) |
| **Enterprise Custom Domain Target** | `qualiverse.kpmg.com` (Mapped via Terraform / Cloud Run Mapping) |

---

## ⚡ Enterprise Infrastructure & Security Architecture

Google Cloud Run (`*.run.app`) provides a fully managed, serverless, SOC 1/2/3 and ISO 27001-compliant execution environment. For enterprise-grade deployments, two URL and traffic routing architectures are supported:

### 1. Default Serverless Endpoint (`*.a.run.app`)
Ideal for development, staging, and automated QA pipelines. Automatically provisioned with Google-managed HTTPS certificates and zero-scaling capability.

### 2. Enterprise Custom Domain & Cloud Armor WAF
To map a custom corporate domain (e.g. `qualiverse.kpmg.com` or `qualiverse.ai`):
```bash
# Map custom domain to Cloud Run using gcloud
gcloud beta run domain-mappings create \
  --service=qualiverse \
  --domain=qualiverse.kpmg.com \
  --region=us-central1
```
Or provision declaratively via Terraform in `terraform/main.tf` by setting:
```hcl
custom_domain     = "qualiverse.kpmg.com"
enable_cloud_armor = true
```

---

## ⚡ Automated Deployment Scripts

### 1. PowerShell Deployment (`deploy-gcp.ps1`)
Run in PowerShell:
```powershell
.\deploy-gcp.ps1 -ProjectId "adv-lighthouse-ai-qa-agent" -Region "us-central1"
```

### 2. Bash Deployment (`deploy-gcp.sh`)
Run in Linux / macOS Bash:
```bash
chmod +x deploy-gcp.sh
./deploy-gcp.sh "adv-lighthouse-ai-qa-agent" "us-central1"
```

### What the Scripts Perform:
1. Verifies `gcloud` CLI installation and configures active GCP project ID.
2. Enables required GCP APIs (`run.googleapis.com`, `firestore.googleapis.com`, `artifactregistry.googleapis.com`, `cloudbuild.googleapis.com`).
3. Creates Docker repository `qualiverse-repo` in Artifact Registry if not exists.
4. Triggers Cloud Build pipeline (`cloudbuild.yaml`) to compile, push image, deploy Cloud Run service, and execute Firestore seeding job.

---

## 🔄 Cloud Build CI/CD Pipeline (`cloudbuild.yaml`)

The `cloudbuild.yaml` file defines a 5-step automated build and deployment pipeline:

```yaml
substitutions:
  _LOCATION: 'us-central1'
  _TAG: 'latest'

steps:
  # 1. Build Single Container Image (Frontend + Backend)
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'build'
      - '-t'
      - '$_LOCATION-docker.pkg.dev/$PROJECT_ID/qualiverse-repo/qualiverse:${_TAG}'
      - '.'

  # 2. Push Image to Artifact Registry
  - name: 'gcr.io/cloud-builders/docker'
    args:
      - 'push'
      - '$_LOCATION-docker.pkg.dev/$PROJECT_ID/qualiverse-repo/qualiverse:${_TAG}'

  # 3. Deploy Application to Cloud Run
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'deploy'
      - 'qualiverse'
      - '--image=$_LOCATION-docker.pkg.dev/$PROJECT_ID/qualiverse-repo/qualiverse:${_TAG}'
      - '--region=$_LOCATION'
      - '--platform=managed'
      - '--allow-unauthenticated'
      - '--set-env-vars=USE_FIRESTORE=true,GCP_PROJECT_ID=$PROJECT_ID,FIRESTORE_DATABASE=qualiverse-db,ENVIRONMENT=production'

  # 4. Deploy Firestore Seed Job
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'jobs'
      - 'deploy'
      - 'qualiverse-seed'
      - '--image=$_LOCATION-docker.pkg.dev/$PROJECT_ID/qualiverse-repo/qualiverse:${_TAG}'
      - '--region=$_LOCATION'
      - '--command=python'
      - '--args=seed.py'
      - '--set-env-vars=USE_FIRESTORE=true,GCP_PROJECT_ID=$PROJECT_ID,FIRESTORE_DATABASE=qualiverse-db'

  # 5. Execute Firestore Seed Job
  - name: 'gcr.io/google.com/cloudsdktool/cloud-sdk'
    entrypoint: gcloud
    args:
      - 'run'
      - 'jobs'
      - 'execute'
      - 'qualiverse-seed'
      - '--region=$_LOCATION'
      - '--wait'
```

---

## 🛠️ Infrastructure as Code (Terraform)

All GCP infrastructure can be managed declaratively using Terraform files in `terraform/`:

```bash
cd terraform
terraform init
terraform apply -var="project_id=adv-lighthouse-ai-qa-agent" -var="region=us-central1"
```

### Terraform Resources Defined:
- `google_project_service.apis`: Enables Cloud Run, Firestore, Artifact Registry, Cloud Build.
- `google_firestore_database.database`: Creates `qualiverse-db` Firestore Native instance.
- `google_artifact_registry_repository.repo`: Provisions `qualiverse-repo` Docker repository.
- `google_service_account.qualiverse_sa`: Creates dedicated Cloud Run service account with `roles/datastore.user` role.
- `google_cloud_run_v2_service.app`: Provisions Cloud Run service with env vars.
- `google_cloud_run_service_iam_member.app_public`: Grants public unauthenticated invoker permissions.

---

## 🐙 GitHub Actions Workflow (`.github/workflows/deploy-gcp.yml`)

Every push to the `main` branch (or manual trigger via `workflow_dispatch`) automatically triggers deployment via GitHub Actions:

```yaml
name: Deploy to Google Cloud Platform

on:
  push:
    branches:
      - main
  workflow_dispatch:

permissions:
  contents: read
  id-token: write

jobs:
  deploy:
    name: Build & Deploy to GCP Cloud Run
    runs-on: ubuntu-latest

    steps:
      - name: Checkout Repository
        uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2
        with:
          project_id: adv-lighthouse-ai-qa-agent

      - name: Submit Google Cloud Build Pipeline
        run: |
          gcloud builds submit --config cloudbuild.yaml --region=us-central1
```

---

## 🔍 Troubleshooting GitHub Actions & Cloud Deployment Failures

If the GitHub Action workflow fails, verify the following 3 common root causes:

### 1. Missing Repository Secret (`GCP_SA_KEY`)
- **Error**: `google-github-actions/auth failed with: Missing required input 'credentials_json'`
- **Fix**: 
  1. In GitHub, go to **Settings** $\rightarrow$ **Secrets and variables** $\rightarrow$ **Actions**.
  2. Create a Repository Secret named **`GCP_SA_KEY`**.
  3. Paste the contents of your Service Account JSON keyfile.

### 2. Missing Deployment Service Account Roles
- **Error**: `PermissionDenied` / `403 Access Not Configured` / `Cloud Build Editor required`
- **Fix**: Ensure the Service Account linked to `GCP_SA_KEY` has the following roles assigned in GCP IAM:
  - **Cloud Build Editor** (`roles/cloudbuild.builds.editor`)
  - **Storage Admin** (`roles/storage.admin`)
  - **Service Usage Consumer** (`roles/serviceusage.serviceUsageConsumer`)

### 3. Missing Cloud Build Service Account Permissions
- **Error**: Cloud Build step fails on `gcloud run deploy` or `gcloud run jobs`
- **Fix**: Grant the Cloud Build Service Account (`[PROJECT_NUMBER]@cloudbuild.gserviceaccount.com`) the following roles:
  - **Cloud Run Admin** (`roles/run.admin`)
  - **Service Account User** (`roles/iam.serviceAccountUser`)
  - **Artifact Registry Writer** (`roles/artifactregistry.writer`)
  - **Cloud Datastore User** (`roles/datastore.user`)
