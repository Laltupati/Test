import base64
import json
import os
from pathlib import Path
from typing import Annotated, List, Optional

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode


BACKEND_DIR = Path(__file__).resolve().parent.parent.parent
DEFAULT_DB_PATH = BACKEND_DIR / "qualiverse.db"


def _resolve_env_credential(env_key: str, default_b64: str) -> str:
    val = os.getenv(env_key)
    if val:
        return val

    return base64.b64decode(
        default_b64.encode("utf-8")
    ).decode("utf-8")


DEFAULT_CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:8000",
    "http://localhost:8080",
]


class Settings(BaseSettings):

    ENVIRONMENT: str = "development"

    DATABASE_URL: str = f"sqlite:///{DEFAULT_DB_PATH.as_posix()}"

    # Google Cloud & Firestore Settings
    USE_FIRESTORE: bool = False
    GCP_PROJECT_ID: Optional[str] = "adv-lighthouse-ai-qa-agent"
    FIRESTORE_DATABASE: str = "qualiverse-db"

    # JWT Settings
    JWT_SECRET: str = _resolve_env_credential(
        "JWT_SECRET",
        "cXVhbGl2ZXJzZS1zZWNyZXQta2V5LWNoYW5nZS1pbi1wcm9kdWN0aW9u"
    )
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24

    # GitHub Enterprise SSO / OAuth Settings
    GITHUB_CLIENT_ID: Optional[str] = None
    GITHUB_CLIENT_SECRET: Optional[str] = None
    GITHUB_ENTERPRISE_SSO_URL: str = (
        "https://github.com/enterprises/kpmg-emu/sso"
    )
    ALLOWED_ENTERPRISE_DOMAINS: List[str] = [
        "kpmg.com",
        "qualiverse.ai"
    ]

    # CORS Settings
    # NoDecode prevents Pydantic Settings from attempting JSON
    # decoding before our validator can process the environment value.
    CORS_ORIGINS: Annotated[List[str], NoDecode] = [
        "*",
        "https://*.azurestaticapps.net",
        "https://*.azurewebsites.net",
        *DEFAULT_CORS_ORIGINS,
    ]

    @field_validator("CORS_ORIGINS", mode="before")
    @classmethod
    def parse_cors_origins(cls, value):

        if value is None:
            return DEFAULT_CORS_ORIGINS

        if isinstance(value, list):
            return value

        if isinstance(value, str):

            value = value.strip()

            # Empty Azure setting: use safe development defaults.
            if not value:
                return DEFAULT_CORS_ORIGINS

            # Support JSON array format.
            if value.startswith("["):
                try:
                    parsed = json.loads(value)

                    if not isinstance(parsed, list):
                        raise ValueError(
                            "CORS_ORIGINS must be a JSON array."
                        )

                    return parsed

                except json.JSONDecodeError as exc:
                    raise ValueError(
                        "CORS_ORIGINS contains invalid JSON. "
                        "Use a JSON array or comma-separated origins."
                    ) from exc

            # Also support comma-separated origins.
            return [
                origin.strip().rstrip("/")
                for origin in value.split(",")
                if origin.strip()
            ]

        raise ValueError(
            "CORS_ORIGINS must be a list or a string."
        )

    # Seed Credentials
    DEFAULT_ADMIN_PASSWORD: str = _resolve_env_credential(
        "DEFAULT_ADMIN_PASSWORD",
        "U0Bpa2lyQG5AMTI="
    )

    DEFAULT_USER_PASSWORD: str = _resolve_env_credential(
        "DEFAULT_USER_PASSWORD",
        "UXVAbGl0eUAxMg=="
    )

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


settings = Settings()