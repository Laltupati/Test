# 🛠️ Minimal Code & Configuration Changes for Azure Migration

This document provides the exact, file-by-file list of minimal changes required to migrate **QualiVerse AI** from Google Cloud (Cloud Run + Firestore) to **Microsoft Azure** (Azure Static Web Apps / App Service + Azure PostgreSQL Flexible Server).

---

## 📊 Summary Checklist

| # | Component | File Path | Action | Description |
|---|---|---|---|---|
| 1 | Backend | `backend/requirements.txt` | **Modify** | Add `psycopg2-binary` PostgreSQL driver |
| 2 | Backend | `backend/app/db/database.py` | **Modify** | Support non-SQLite connection arguments for PostgreSQL |
| 3 | Backend | `backend/app/core/config.py` | **Modify** | Update CORS allowed origins for Azure domain |
| 4 | Frontend | `frontend/public/staticwebapp.config.json` | **Create** | SPA client-side routing fallback & security headers |
| 5 | Backend Container | `backend/Dockerfile` | **Create** | Dedicated backend container image definition |
| 6 | Environment | `.env` / Azure App Settings | **Configure** | Set database connection string & feature flags |

---

## 📁 Detailed File Modifications

### 1. Backend Dependency (`backend/requirements.txt`)
**Action:** Add the PostgreSQL binary adapter for Python/SQLAlchemy.

```diff
  fastapi>=0.111.0
  uvicorn[standard]>=0.30.0
  gunicorn>=21.2.0
  sqlalchemy>=2.0.36
  alembic>=1.13.0
+ psycopg2-binary>=2.9.9
  pydantic>=2.7.0
  pydantic-settings>=2.2.0
  email-validator>=2.0.0
  python-jose[cryptography]>=3.3.0
  passlib[bcrypt]>=1.7.4
  bcrypt==4.0.1
  python-multipart>=0.0.9
  python-dotenv>=1.0.0
  google-cloud-firestore>=2.14.0
  httpx>=0.27.0
```

---

### 2. SQLAlchemy Engine Configuration (`backend/app/db/database.py`)
**Action:** Remove hardcoded SQLite-only `check_same_thread` argument to allow PostgreSQL connections.

```diff
  from sqlalchemy import create_engine
  from sqlalchemy.ext.declarative import declarative_base
  from sqlalchemy.orm import sessionmaker
  from app.core.config import settings

- engine = create_engine(settings.DATABASE_URL, connect_args={"check_same_thread": False})
+ connect_args = {"check_same_thread": False} if settings.DATABASE_URL.startswith("sqlite") else {}
+ engine = create_engine(settings.DATABASE_URL, connect_args=connect_args)
  SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
  Base = declarative_base()

  def get_db():
      if settings.USE_FIRESTORE:
          yield None
          return
      db = SessionLocal()
      try:
          yield db
      finally:
          db.close()
```

---

### 3. CORS Domain Settings (`backend/app/core/config.py`)
**Action:** Include production Azure frontend origins.

```diff
    # CORS Settings
-   CORS_ORIGINS: List[str] = ["*"]
+   CORS_ORIGINS: List[str] = [
+       "https://<your-app-name>.azurestaticapps.net",
+       "https://<your-custom-domain>.com",
+       "http://localhost:5173",
+       "http://localhost:8080"
+   ]
```

---

### 4. SPA Client Routing (`frontend/public/staticwebapp.config.json`)
**Action:** Create this file so React Router navigation (`/login`, `/dashboard`, `/admin`) works seamlessly without returning 404 errors on page reloads.

**File Content:**
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

---

### 5. Dedicated Backend Dockerfile (`backend/Dockerfile`)
**Action:** Create a standalone Dockerfile for the backend service (when deploying decoupled frontend + backend).

**File Content:**
```dockerfile
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PORT=8080

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

COPY . .

RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:${PORT}/health || exit 1

CMD exec gunicorn --bind 0.0.0.0:${PORT} --workers 2 --worker-class uvicorn.workers.UvicornWorker --timeout 120 app.main:app
```

---

## ⚙️ Azure Environment Configuration

Set these environment variables in the Azure Container App / App Service configuration settings:

| Variable Name | Required Value | Purpose |
|---|---|---|
| `USE_FIRESTORE` | `False` | Switches data persistence to the relational SQLAlchemy backend |
| `DATABASE_URL` | `postgresql+psycopg2://<admin>:<password>@<server-name>.postgres.database.azure.com:5432/qualiverse_db?sslmode=require` | Azure Database for PostgreSQL connection string |
| `JWT_SECRET` | `<32-char-random-secure-secret>` | Secret for signing JWT authentication tokens |
| `ENVIRONMENT` | `production` | Enables production security policies |
| `DEFAULT_ADMIN_PASSWORD` | `<secure-admin-password>` | Initial seed admin password |
| `DEFAULT_USER_PASSWORD` | `<secure-user-password>` | Initial seed user password |

---

## 🌐 Frontend Build Configuration

Set this build-time environment variable for the React frontend build:

| Environment Variable | Value | Description |
|---|---|---|
| `VITE_API_BASE_URL` | `https://<your-backend-url>/api/v1` | URL where the frontend Axios client dispatches API requests |

---

## 🚀 Post-Deployment Verification Steps

1. **Verify Database Connectivity**:
   Check the `/health` endpoint on your backend URL:
   ```bash
   curl https://<backend-url>/health
   ```
   **Expected Response:**
   ```json
   {
     "status": "healthy",
     "environment": "production",
     "database": "sqlite/sqlalchemy",
     "database_status": "healthy"
   }
   ```

2. **Seed Initial Database Content**:
   Connect to the backend container console and execute:
   ```bash
   python seed.py
   ```
   This initializes all projects, tags, capabilities, and seed accounts in the Azure PostgreSQL database.
