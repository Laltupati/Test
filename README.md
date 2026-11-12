# QualiVerse AI — Azure deployment (App Service backend)

## Target Azure architecture

- **Frontend:** Azure Static Web Apps (Standard), React 19 + Vite, build runtime Node.js 22 LTS.
- **Backend:** Azure App Service on Linux, FastAPI, Python 3.11.
- **Database:** Azure Database for PostgreSQL Flexible Server 15.
- **Secrets:** App Service application settings for initial deployment; Azure Key Vault is recommended for production.
- **Monitoring:** App Service diagnostics and (recommended) Application Insights / Log Analytics.
- **Infrastructure:** Terraform in `terraform/azure`.

This version uses **Azure App Service (Web App)** for the backend. It does not require Azure Container Apps or Azure Container Registry. The backend is deployed as source ZIP with Oryx installing `backend/requirements.txt`.

## 1. Azure resources to create

| Resource | Suggested name | Purpose | Required? |
|---|---|---|---|
| Resource Group | `rg-qualiverse-dev` | Logical container for resources | Yes |
| App Service Plan (Linux) | `asp-qualiverse-dev` | Compute capacity for backend Web App | Yes |
| App Service Web App (Linux) | `app-qualiverse-api-<suffix>` | Hosts FastAPI backend | Yes |
| Azure Static Web App | `swa-qualiverse-frontend` | Hosts React frontend | Yes |
| PostgreSQL Flexible Server | `psql-qualiverse-<suffix>` | Application database | Yes |
| PostgreSQL database | `qualiverse_db` | App data | Yes |
| Application Insights | `appi-qualiverse-dev` | Application performance, exceptions and requests | Recommended |
| Log Analytics Workspace | `log-qualiverse-dev` | Central diagnostics and query | Recommended |
| Key Vault | `kv-qualiverse-<unique-suffix>` | Store JWT/database/OAuth secrets | Strongly recommended |
| Private Endpoint + VNet | As per enterprise network standards | Private access to PostgreSQL/Key Vault | Production recommendation |

**Not required for this design:** Azure Container Apps Environment, Azure Container App, Azure Container Registry, Docker image build/push. Those are only needed for container-based hosting.

## 2. Stack versions and commands

| Component | Azure stack | Build/deployment | Startup |
|---|---|---|---|
| Frontend | Node.js 22 LTS for build | `npm ci && npm run build` | No startup command; Static Web Apps serves `dist` |
| Backend | Linux App Service, Python 3.11 | Oryx: install `requirements.txt` | `gunicorn --bind=0.0.0.0:8000 --workers 2 --worker-class uvicorn.workers.UvicornWorker --timeout 120 app.main:app` |
| Database | PostgreSQL Flexible Server 15 | Managed service | Not applicable |

The backend's ASGI entry point is `app.main:app`. Python 3.11 requires an explicit startup command for FastAPI on App Service. Microsoft documents the custom Gunicorn/Uvicorn startup approach for Python 3.13 and earlier. See the official [Python App Service quickstart](https://learn.microsoft.com/azure/app-service/quickstart-python). If you later choose Python 3.14, validate all dependency compatibility and App Service runtime availability first.

## 3. Create resources using Terraform

Requirements: Azure CLI, Terraform 1.3+, Node.js 22, Python 3.11.

```bash
az login
az account set --subscription "<AZURE_SUBSCRIPTION_ID>"
cd terraform/azure
terraform init
```

Set secrets in your terminal (never commit them):

```bash
export TF_VAR_db_admin_password="$(openssl rand -hex 32)"
export TF_VAR_jwt_secret="$(openssl rand -hex 32)"
```

Apply for Development:

```bash
terraform plan \
  -var="resource_group_name=rg-qualiverse-dev" \
  -var="location=eastus" \
  -var="environment=development" \
  -var="app_service_sku=B1"

terraform apply \
  -var="resource_group_name=rg-qualiverse-dev" \
  -var="location=eastus" \
  -var="environment=development" \
  -var="app_service_sku=B1"
```

For Production, select an App Service Plan SKU based on expected traffic. `P1v3` is a reasonable starting point for a production evaluation, not a guaranteed capacity recommendation. The plan is shared by all Web Apps placed on it.

Retrieve the app details:

```bash
terraform output
BACKEND_URL="$(terraform output -raw backend_api_url)"
BACKEND_APP="$(terraform output -raw backend_web_app_name)"
FRONTEND_URL="$(terraform output -raw frontend_static_web_app_url)"
```

The Terraform creates the Resource Group, Linux App Service Plan, Linux Web App, PostgreSQL Flexible Server/database, and Static Web App. It configures the backend's core application settings and PostgreSQL connection.

> Terraform state contains sensitive values such as the database connection string and JWT secret. Use a protected remote state backend and strict RBAC for team/production deployments. For a hardened setup, move secrets to Key Vault and use the Web App's managed identity with Key Vault access.

## 4. Backend App Service configuration

### Runtime stack

Azure Portal → App Service → Settings → Configuration → General settings:

- Operating System: Linux
- Stack: Python
- Major version: 3.11
- Startup Command:

```bash
gunicorn --bind=0.0.0.0:8000 --workers 2 \
  --worker-class uvicorn.workers.UvicornWorker \
  --timeout 120 app.main:app
```

Terraform configures Python 3.11 and this startup command is also set as the Web App startup command if needed by the deployment environment.

### Environment variables

| App Setting | Value / description |
|---|---|
| `ENVIRONMENT` | `development` or `production` |
| `DATABASE_URL` | PostgreSQL SQLAlchemy connection string |
| `USE_FIRESTORE` | `false` |
| `JWT_SECRET` | Unique random secret, minimum 32 characters |
| `JWT_ALGORITHM` | `HS256` |
| `JWT_ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` |
| `CORS_ORIGINS` | JSON array containing exact frontend origin, e.g. `["https://<swa-host>.azurestaticapps.net"]` |
| `SCM_DO_BUILD_DURING_DEPLOYMENT` | `true` |
| `ENABLE_ORYX_BUILD` | `true` |
| `PORT` | `8000` |
| `GITHUB_CLIENT_ID` | Only if GitHub OAuth is enabled |
| `GITHUB_CLIENT_SECRET` | Only if GitHub OAuth is enabled; secret |
| `GITHUB_ENTERPRISE_SSO_URL` | Optional GitHub Enterprise SSO URL |
| `ALLOWED_ENTERPRISE_DOMAINS` | Optional JSON array of permitted domains |
| `DEFAULT_ADMIN_PASSWORD` | Only if seed process requires it; unique secret |
| `DEFAULT_USER_PASSWORD` | Only if seed process requires it; unique secret |

Database URL format:

```text
postgresql+psycopg2://<username>:<password>@<server>.postgres.database.azure.com:5432/qualiverse_db?sslmode=require
```

URL-encode reserved characters in the username/password. Never put backend secrets in frontend `VITE_*` settings.

### Configure or update settings using Azure CLI

```bash
az webapp config appsettings set \
  --resource-group rg-qualiverse-dev \
  --name "$BACKEND_APP" \
  --settings \
    ENVIRONMENT=development \
    USE_FIRESTORE=false \
    SCM_DO_BUILD_DURING_DEPLOYMENT=true \
    ENABLE_ORYX_BUILD=true \
    PORT=8000
```

Terraform supplies the database URL and JWT secret. Avoid overwriting them with empty values.

## 5. Deploy backend code

Deploy from the backend directory so `app/` and `requirements.txt` are at the ZIP root:

```bash
cd backend
zip -r ../backend.zip . \
  -x ".venv/*" "__pycache__/*" "*.pyc" ".env"
cd ..

az webapp deploy \
  --resource-group rg-qualiverse-dev \
  --name "$BACKEND_APP" \
  --src-path backend.zip \
  --type zip
```

App Service uses Oryx to install dependencies from `requirements.txt` during deployment. Enable deployment build settings before deploying. After deployment:

```bash
az webapp restart --resource-group rg-qualiverse-dev --name "$BACKEND_APP"
curl -i "$BACKEND_URL/health"
curl -i "$BACKEND_URL/docs"
```

Expected health response: `status=healthy` and `database_status=healthy`.

## 6. Deploy frontend

Frontend is React + Vite. Node.js is only needed to build the site; Azure Static Web Apps serves the generated static files.

```bash
cd frontend
npm ci
VITE_API_BASE_URL="$BACKEND_URL/api/v1" npm run build
cd ..
```

Deploy `frontend/dist` to Azure Static Web Apps using the deployment token. The token is available in the Static Web App resource's deployment token settings. Do not commit it.

```bash
npx @azure/static-web-apps-cli deploy ./frontend/dist \
  --deployment-token "<SWA_DEPLOYMENT_TOKEN>" \
  --env production
```

After deployment, make sure `CORS_ORIGINS` on the backend contains the exact Static Web App origin, including `https://`, without a trailing slash. Frontend API URL is a build-time setting; rebuild the frontend if the backend URL changes.

## 7. GitHub Actions CI/CD

The included `.github/workflows/deploy-azure.yml` now deploys backend ZIP to Azure App Service and frontend build to Azure Static Web Apps.

Configure repository secrets:

- `AZURE_CREDENTIALS`: service principal credentials for Azure login (OIDC federation is preferable for production).
- `AZURE_RESOURCE_GROUP`: resource group name.
- `AZURE_BACKEND_WEBAPP_NAME`: backend Web App name.
- `AZURE_BACKEND_API_URL`: backend origin, e.g. `https://<app>.azurewebsites.net`.
- `AZURE_STATIC_WEB_APPS_API_TOKEN`: Static Web Apps deployment token.

The Azure identity needs permissions to deploy to the Web App and Static Web App. Push to `main` or manually run the workflow.

## 8. Monitoring and validation

Enable App Service Application Logging and Web Server Logging. Connect Application Insights for request telemetry, dependency tracking, exceptions, and performance. Use Log Analytics for centralized querying if required by the organization's monitoring standard.

```bash
az webapp log config \
  --name "$BACKEND_APP" \
  --resource-group rg-qualiverse-dev \
  --application-logging filesystem \
  --web-server-logging filesystem

az webapp log tail \
  --name "$BACKEND_APP" \
  --resource-group rg-qualiverse-dev
```

Validate:
1. `/health` returns healthy.
2. `/docs` loads.
3. Frontend loads and deep links refresh correctly.
4. Login/register requests reach `/api/v1`.
5. Browser developer console shows no CORS errors.
6. Database reads/writes persist after app restart.

## 9. Production hardening

- Use Key Vault references for `DATABASE_URL`, `JWT_SECRET`, and OAuth secrets; grant the Web App managed identity only the required secret-read permission.
- Restrict PostgreSQL networking. The current Terraform firewall rule allowing Azure services is broad; replace it with private networking/private endpoint or tightly scoped outbound IP rules.
- Use a private endpoint/VNet integration where required by enterprise policy.
- Use a protected Terraform remote state backend.
- Enable HTTPS-only, minimum TLS 1.2, managed identity, and diagnostic settings.
- Add Application Insights and alerts for availability, failures, latency, and dependency failures.
- Review seed scripts and ensure any initial credentials are unique and rotated.
- The application currently calls SQLAlchemy `create_all` during startup; use Alembic migrations as the schema evolves.
- Review the application authentication and authorization implementation before exposing it publicly.

