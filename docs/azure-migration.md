# ☁️ Azure Migration Plan & Architectural Blueprint for QualiVerse AI

---

## Executive Summary & Architectural Recommendation

Your team has proposed hosting **QualiVerse AI** across **two Azure App Services (Linux Web Apps)** — one for the React frontend and one for the FastAPI backend.

While this approach is technically functional, **running a static Single Page Application (SPA) on a dedicated Azure App Service is suboptimal for cost, performance, and operational maintenance**.

Below is the expert architectural evaluation, followed by the recommended architectures, comparison matrix, and end-to-end migration roadmap.

---

## 🏛️ Architectural Options Comparison

| Feature / Metric | 🏆 Option 1: Modern Cloud-Native (Recommended) | 🔄 Option 2: Unified Container (Direct GCP Parity) | ⚠️ Option 3: Team Proposal (Two Web Apps) |
| :--- | :--- | :--- | :--- |
| **Frontend** | **Azure Static Web Apps (SWA)** | Unified Container (FastAPI serves SPA) | **Azure App Service (Linux Web App)** |
| **Backend** | **Azure Container Apps (ACA)** or **App Service** | **Azure Container Apps** or **App Service** | **Azure App Service (Linux / Python)** |
| **Database** | **Azure Database for PostgreSQL (Flexible)** | **Azure Database for PostgreSQL (Flexible)** | **Azure Database for PostgreSQL / Cosmos DB** |
| **Global Edge & CDN** | Built-in Free Global Anycast CDN | Requires Azure Front Door / CDN add-on | Requires Azure Front Door / CDN add-on |
| **Hosting Cost** | **Lowest** (SWA has free/standard tiers; ACA scales to zero) | **Low** (Single compute plan for both API + static files) | **Higher** (2 dedicated App Service Plans / compute instances) |
| **SPA Routing & Caching** | Native (`staticwebapp.config.json`) with edge caching | FastAPI fallback (`/{full_path:path}`) | Custom Nginx/Node server configuration needed on App Service |
| **Deployment Complexity** | Low (Native GitHub Actions / SWA workflow) | Lowest (Single Docker container deployment) | Medium (Two separate CI/CD pipelines & App Services) |
| **CORS Handling** | Managed via SWA backend linking or standard CORS headers | Same-origin (Zero CORS issues) | Cross-origin configuration required |

---

### 💡 Why Option 1 (Azure Static Web Apps + Azure Container Apps/App Service) is Superior to Two App Services:

1. **Static Files Belong on a CDN, Not on Compute**: React/Vite generates static HTML, CSS, and JS bundles. Running a full Linux App Service compute instance (paying for 1–2 CPU cores and 2–4 GB RAM) just to serve static assets is an unnecessary cost ($40–$150/mo depending on SKU).
2. **Global Edge Delivery & Faster Latency**: Azure Static Web Apps distributes files across Microsoft's global edge network automatically with built-in SSL certificates and zero server maintenance.
3. **Database Selection — PostgreSQL over Cosmos DB**:
   - The QualiVerse AI codebase already contains a **complete, production-ready SQLAlchemy ORM relational layer** (`backend/app/db/models.py`, `backend/app/crud/crud_project.py`, and `backend/app/crud/crud_user.py`).
   - By provisioning **Azure Database for PostgreSQL (Flexible Server)**, you can migrate with **zero database code rewrite** (just setting `DATABASE_URL=postgresql+psycopg2://...`).

---

## 🗺️ GCP to Azure Service Mapping

| Component | Current GCP Architecture | Recommended Azure Target | Alternative Azure Target |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | Bundled in Cloud Run container | **Azure Static Web Apps (SWA)** | Azure App Service / Blob Storage + CDN |
| **Backend API** | Google Cloud Run (`app.main:app`) | **Azure Container Apps (ACA)** | **Azure App Service for Linux (Container)** |
| **Database** | Google Cloud Firestore / SQLite | **Azure Database for PostgreSQL (Flexible Server)** | **Azure Cosmos DB (for NoSQL)** |
| **Container Registry** | Google Artifact Registry (`gcr.io`) | **Azure Container Registry (ACR)** | GitHub Container Registry (GHCR) |
| **Secret Management** | Google Secret Manager | **Azure Key Vault** | App Service Application Settings |
| **CI/CD** | Cloud Build / `cloudbuild.yaml` | **GitHub Actions / Azure DevOps** | Azure Container Apps build & deploy |
| **Security & WAF** | Google Cloud Armor | **Azure Front Door (Standard/Premium)** | Azure Application Gateway with WAF |
| **Identity / SSO** | GitHub OAuth + JWT | **Azure Entra ID (Azure AD)** or **GitHub SSO** | Built-in App Service EasyAuth |

---

## 🏗️ Detailed Target Architecture (Option 1: Recommended)

```
                            ┌──────────────────────────────────────────────┐
                            │             Users / Web Browsers             │
                            └──────────────────────┬───────────────────────┘
                                                   │
                   ┌───────────────────────────────┴───────────────────────────────┐
                   │                                                               │
                   ▼                                                               ▼
    ┌──────────────────────────────┐                              ┌──────────────────────────────┐
    │   Azure Static Web Apps      │                              │    Azure Container Apps /    │
    │   (React + Vite SPA)         │                              │    Azure App Service         │
    │  - Global CDN Edge           │                              │  - FastAPI backend (Port 8080│
    │  - Auto HTTPS & Domain       │ ──────── API Calls ────────▶ │  - Auto-scaling (Scale to 0) │
    │  - staticwebapp.config.json  │    (/api/v1/* via HTTPS)     │  - Non-root Container        │
    └──────────────────────────────┘                              └──────────────┬───────────────┘
                                                                                 │
                                          ┌──────────────────────────────────────┼──────────────────────────────────────┐
                                          │                                      │                                      │
                                          ▼                                      ▼                                      ▼
                           ┌──────────────────────────────┐       ┌──────────────────────────────┐       ┌──────────────────────────────┐
                           │ Azure Database for PostgreSQL│       │      Azure Key Vault         │       │  Azure Container Registry    │
                           │ (Flexible Server)            │       │  - JWT_SECRET                │       │  (ACR)                       │
                           │  - Users, Projects, Tags     │       │  - DB Credentials            │       │  - Backend Container Images  │
                           │  - Automated backups         │       │  - Managed Identity access   │       │                              │
                           └──────────────────────────────┘       └──────────────────────────────┘       └──────────────────────────────┘
```

---

## 📋 End-to-End Migration Step-by-Step Plan

### Phase 1: Database Strategy & Provisioning

1. **Provision Azure Database for PostgreSQL (Flexible Server)**:
   - Compute: `Standard_B1ms` (Dev/Test) or `Standard_D2ds_v5` (Production).
   - Enable SSL connection (`require_secure_transport = ON`).
   - Create database: `qualiverse_db`.
2. **Migrate Existing Firestore Data to PostgreSQL**:
   - Run a migration script using `backend/seed.py` or export Firestore documents and load into PostgreSQL tables mapped by `models.py`.
3. **Update Backend DB Config**:
   - Add `psycopg2-binary` to `backend/requirements.txt`.
   - Configure connection string: `DATABASE_URL=postgresql://<user>:<password>@<server>.postgres.database.azure.com:5432/qualiverse_db?sslmode=require`.
   - Toggle `USE_FIRESTORE=False` in environment settings.

---

### Phase 2: Backend Containerization & Azure Deployment

1. **Backend Dockerfile (`backend/Dockerfile`)**:
   Create a dedicated backend Dockerfile or adapt the existing one:
   ```dockerfile
   FROM python:3.11-slim
   ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PORT=8080
   WORKDIR /app
   RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
   COPY requirements.txt .
   RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt
   COPY . .
   RUN useradd -m appuser && chown -R appuser:appuser /app
   USER appuser
   EXPOSE 8080
   CMD exec gunicorn --bind 0.0.0.0:${PORT} --workers 2 --worker-class uvicorn.workers.UvicornWorker --timeout 120 app.main:app
   ```

2. **Deploy Backend to Azure**:
   - **Target A (Azure Container Apps)**:
     ```bash
     az containerapp create \
       --name qualiverse-api \
       --resource-group rg-qualiverse-prod \
       --environment env-qualiverse \
       --image <acr_name>.azurecr.io/qualiverse-backend:latest \
       --target-port 8080 \
       --ingress external \
       --min-replicas 1 \
       --max-replicas 10 \
       --env-vars DATABASE_URL=secretref:db-url JWT_SECRET=secretref:jwt-secret USE_FIRESTORE=False
     ```
   - **Target B (Azure App Service Linux Container)**:
     ```bash
     az webapp create \
       --resource-group rg-qualiverse-prod \
       --plan plan-qualiverse-backend \
       --name qualiverse-api-app \
       --deployment-container-image-name <acr_name>.azurecr.io/qualiverse-backend:latest
     ```

---

### Phase 3: Frontend Deployment (Azure Static Web Apps)

1. **Configure SPA Client-Side Routing**:
   Create `frontend/staticwebapp.config.json` to handle React Router 404 fallbacks and security headers:
   ```json
   {
     "navigationFallback": {
       "rewrite": "/index.html",
       "exclude": ["/assets/*.{css,js,png,jpg,gif,svg,webp}", "/favicon.ico"]
     },
     "responseOverrides": {
       "404": {
         "rewrite": "/index.html",
         "statusCode": 200
       }
     },
     "globalHeaders": {
       "X-Content-Type-Options": "nosniff",
       "X-Frame-Options": "SAMEORIGIN",
       "Strict-Transport-Security": "max-age=31536000; includeSubDomains"
     },
     "mimeTypes": {
       ".json": "text/json"
     }
   }
   ```

2. **Build and Deploy**:
   - Set environment variable at build time: `VITE_API_BASE_URL=https://<your-backend-api-url>/api/v1`.
   - Deploy using Azure Static Web Apps CLI (`swa deploy`) or GitHub Actions.

---

### Phase 4: CORS & Security Configuration

1. **Enable CORS on FastAPI Backend**:
   Ensure `CORS_ORIGINS` in `backend/app/core/config.py` includes the frontend URL:
   ```python
   CORS_ORIGINS = [
       "https://<your-static-web-app>.azurestaticapps.net",
       "https://qualiverse.yourdomain.com",
       "http://localhost:5173"
   ]
   ```

2. **Secrets & Managed Identities**:
   - Store database credentials and `JWT_SECRET` in **Azure Key Vault**.
   - Enable **System-Assigned Managed Identity** on the Container App / App Service to fetch secrets directly without hardcoding credentials.

---

### Phase 5: CI/CD Pipeline (GitHub Actions Example)

Create `.github/workflows/deploy-azure.yml`:

```yaml
name: Deploy QualiVerse AI to Azure

on:
  push:
    branches: [ main ]

jobs:
  build-and-deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: azure/login@v1
        with:
          creds: ${{ secrets.AZURE_CREDENTIALS }}

      - name: Build and Push Docker Image to ACR
        run: |
          az acr login --name ${{ secrets.ACR_NAME }}
          docker build -t ${{ secrets.ACR_NAME }}.azurecr.io/qualiverse-backend:${{ github.sha }} ./backend
          docker push ${{ secrets.ACR_NAME }}.azurecr.io/qualiverse-backend:${{ github.sha }}

      - name: Deploy to Azure Container Apps
        uses: azure/container-apps-deploy-action@v1
        with:
          imageToDeploy: ${{ secrets.ACR_NAME }}.azurecr.io/qualiverse-backend:${{ github.sha }}
          containerAppName: qualiverse-api
          resourceGroup: rg-qualiverse-prod

  build-and-deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy Frontend to Azure Static Web Apps
        uses: Azure/static-web-apps-deploy@v1
        with:
          azure_static_web_apps_api_token: ${{ secrets.AZURE_STATIC_WEB_APPS_API_TOKEN }}
          repo_token: ${{ secrets.GITHUB_TOKEN }}
          action: "upload"
          app_location: "/frontend"
          output_location: "dist"
          app_build_command: "npm run build"
        env:
          VITE_API_BASE_URL: ${{ secrets.PROD_API_BASE_URL }}
```

---

## 🛡️ Summary Recommendation for Your Team

1. **Do not deploy the React frontend to a separate App Service**:
   Use **Azure Static Web Apps (SWA)** instead. It gives free SSL, edge caching, zero maintenance, and will save you 70–80% of hosting costs compared to running a second App Service.
2. **For the Backend**:
   Use **Azure Container Apps** (serverless containers) or **Azure App Service (Linux Web App)** with the containerized FastAPI backend.
3. **For the Database**:
   Use **Azure Database for PostgreSQL (Flexible Server)**. Because QualiVerse AI already contains full SQLAlchemy models and CRUD endpoints, you will avoid re-architecting data access layers.
4. **Alternative (Fastest 1:1 Parity)**:
   If your team wants zero code or architecture changes, keep the single container `Dockerfile` and run it on **Azure Container Apps** or **Azure App Service** as a single deployment.
