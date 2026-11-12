import logging
from pathlib import Path
from fastapi import FastAPI, Request, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from sqlalchemy import text
from app.core.config import settings
from app.db.database import engine
from app.db.models import Base
from app.db.firestore_db import check_firestore_connection
from app.api.v1.api_router import api_router

# Configure Enterprise Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("qualiverse.api")

if not settings.USE_FIRESTORE:
    logger.info("Initializing relational database (SQLAlchemy)...")
    Base.metadata.create_all(bind=engine)
else:
    logger.info("Configured to use Google Cloud Firestore as primary database.")

app = FastAPI(
    title="QualiVerse AI API",
    description="Enterprise AI Solutions Directory - Cloud Run Single Container",
    version="1.0.0"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security Headers Middleware (Enterprise Grade)
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "SAMEORIGIN"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    return response

app.include_router(api_router, prefix="/api/v1")

@app.get("/health")
def health_check():
    if settings.USE_FIRESTORE:
        database_name = "firestore"
        database_ok = check_firestore_connection()
    else:
        database_name = "postgresql" if settings.DATABASE_URL.startswith(("postgresql", "postgres")) else "sqlite/sqlalchemy"
        try:
            with engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            database_ok = True
        except Exception:
            logger.exception("Database health check failed")
            database_ok = False

    return {
        "status": "healthy" if database_ok else "degraded",
        "environment": settings.ENVIRONMENT,
        "database": database_name,
        "database_status": "healthy" if database_ok else "unhealthy"
    }

# Serve static frontend build (Single Container Setup like interview-app)
BASE_DIR = Path(__file__).resolve().parent
static_candidates = [
    BASE_DIR.parent / "static",                  # /app/static in Docker
    BASE_DIR.parent.parent / "static",           # Root static directory
    BASE_DIR.parent.parent / "frontend" / "dist",  # Frontend dist directory
]

static_path = None
for candidate in static_candidates:
    if candidate.exists() and (candidate / "index.html").exists():
        static_path = candidate
        break

if static_path:
    logger.info(f"Serving static frontend files from: {static_path}")
    
    assets_dir = static_path / "assets"
    if assets_dir.exists():
        app.mount("/assets", StaticFiles(directory=str(assets_dir)), name="assets")

    @app.get("/")
    async def serve_root():
        return FileResponse(static_path / "index.html")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        file_path = static_path / full_path
        if file_path.is_file():
            return FileResponse(file_path)
        return FileResponse(static_path / "index.html")
else:
    logger.warning("No static frontend build directory found. SPA serving disabled.")
