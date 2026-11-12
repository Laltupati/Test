import os
import logging
from typing import Optional
from google.cloud import firestore
from app.core.config import settings

logger = logging.getLogger("qualiverse.firestore")

_db_client: Optional[firestore.Client] = None

def get_firestore_client() -> firestore.Client:
    """Returns a singleton instance of the Google Cloud Firestore client."""
    global _db_client
    if _db_client is None:
        try:
            project_id = settings.GCP_PROJECT_ID or os.getenv("GOOGLE_CLOUD_PROJECT") or os.getenv("GCP_PROJECT")
            database_id = settings.FIRESTORE_DATABASE or "qualiverse-db"
            
            if project_id:
                logger.info(f"Initializing Firestore client for project: {project_id}, database: {database_id}")
                _db_client = firestore.Client(project=project_id, database=database_id)
            else:
                logger.info("Initializing Firestore client using default GCP environment")
                _db_client = firestore.Client(database=database_id)
        except Exception as e:
            logger.error(f"Failed to initialize Firestore client: {e}")
            raise e
    return _db_client

def check_firestore_connection() -> bool:
    """Utility to verify Firestore connectivity."""
    try:
        db = get_firestore_client()
        # Ping metadata/collections
        _ = next(db.collections(), None)
        return True
    except Exception as e:
        logger.warning(f"Firestore health check failed: {e}")
        return False
