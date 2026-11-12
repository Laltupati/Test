# 🌐 Multi-Cloud Architecture & Team Handoff Guide (Azure & GCP)

QualiVerse AI is configured as a **multi-cloud enterprise platform**. It can be deployed to either:
1. **Google Cloud Platform (GCP)**: Serverless container on **Cloud Run** with **Cloud Firestore Native**.
2. **Microsoft Azure**: Cloud-native decoupled hosting on **Azure Static Web Apps (SWA)** + **Azure Container Apps / App Service** backed by **Azure Database for PostgreSQL Flexible Server**.

---

## 📦 What to Provide to Each Team

When collaborating with external teams or cloud-specific deployment teams, use this table to hand off **only what is required** for each target environment:

### 🔵 1. Azure Team Package (What to Provide to the Azure Team)

If providing the project to an Azure engineering/DevOps team, provide:

| Path / Artifact | Purpose |
|---|---|
| `backend/` | Python FastAPI REST API with SQLAlchemy models & CRUD |
| `backend/Dockerfile` | Dedicated backend Docker container configuration |
| `backend/requirements.txt` | Python dependencies (includes `psycopg2-binary` for Azure PostgreSQL) |
| `frontend/` | React + TypeScript + Vite UI source code |
| `frontend/public/staticwebapp.config.json` | Azure Static Web Apps routing & fallback rules |
| `terraform/azure/` | Complete Terraform IaC templates (ACR, PostgreSQL, Container Apps, SWA) |
| `deploy-azure.ps1` / `deploy-azure.sh` | One-click automated Azure deployment scripts |
| `.github/workflows/deploy-azure.yml` | GitHub Actions CI/CD workflow for Azure |
| `docs/azure-migration.md` | Azure architecture blueprint & recommendations |
| `docs/azure-migration-changes.md` | Minimal changes checklist |

**Azure Environment Variables Needed**:
```env
USE_FIRESTORE=false
DATABASE_URL=postgresql+psycopg2://<user>:<password>@<server>.postgres.database.azure.com:5432/qualiverse_db?sslmode=require
JWT_SECRET=<secure-jwt-secret>
ENVIRONMENT=production
```

---

### 🔴 2. GCP Team Package (What to Provide to the GCP Team)

If providing the project to a Google Cloud team, provide:

| Path / Artifact | Purpose |
|---|---|
| `backend/` | Python FastAPI REST API |
| `frontend/` | React + TypeScript UI source code |
| `Dockerfile` (root) | Multi-stage Dockerfile bundling frontend & backend for Cloud Run |
| `cloudbuild.yaml` | Google Cloud Build pipeline configuration |
| `terraform/gcp/` | Complete Terraform IaC templates (Cloud Run, Firestore, Artifact Registry) |
| `deploy-gcp.ps1` / `deploy-gcp.sh` | One-click automated Google Cloud deployment scripts |
| `.github/workflows/deploy-gcp.yml` | GitHub Actions CI/CD workflow for GCP |
| `docs/gcp-deployment.md` | GCP Cloud Run & Firestore deployment documentation |
| `docs/firestore-schema.md` | Firestore collections & schema documentation |

**GCP Environment Variables Needed**:
```env
USE_FIRESTORE=true
GCP_PROJECT_ID=adv-lighthouse-ai-qa-agent
FIRESTORE_DATABASE=qualiverse-db
JWT_SECRET=<secure-jwt-secret>
ENVIRONMENT=production
```

---

## ⚙️ How the Dual Implementation Works Under the Hood

The codebase dynamically switches between cloud backends based on the `USE_FIRESTORE` environment variable:

```
                          ┌──────────────────────────┐
                          │   FastAPI API Router     │
                          │      (/api/v1/*)         │
                          └────────────┬─────────────┘
                                       │
                         Is USE_FIRESTORE == true?
                                       │
                    ┌──────────────────┴──────────────────┐
                    │                                     │
                 [ YES ]                               [ NO ]
                    │                                     │
                    ▼                                     ▼
      ┌───────────────────────────┐         ┌───────────────────────────┐
      │  Google Cloud Firestore   │         │  SQLAlchemy Relational    │
      │  (app/crud/firestore_crud)│         │  (Azure PostgreSQL/SQLite)│
      └───────────────────────────┘         └───────────────────────────┘
```

1. **When `USE_FIRESTORE=true` (GCP)**:
   - Queries interact directly with Google Cloud Firestore (`qualiverse-db`).
2. **When `USE_FIRESTORE=false` (Azure / Local)**:
   - Queries interact with Azure PostgreSQL Flexible Server (or SQLite locally) via SQLAlchemy ORM.

---

## 🚀 Quick Deployment Commands

### Deploying to Azure
```powershell
# Windows
.\deploy-azure.ps1 -ResourceGroupName "rg-qualiverse-prod" -Location "eastus"

# Linux / macOS
./deploy-azure.sh "rg-qualiverse-prod" "eastus"
```

### Deploying to GCP
```powershell
# Windows
.\deploy-gcp.ps1 -ProjectId "adv-lighthouse-ai-qa-agent" -Region "us-central1"

# Linux / macOS
./deploy-gcp.sh "adv-lighthouse-ai-qa-agent" "us-central1"
```
