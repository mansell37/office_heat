"""Environment-driven configuration. Secrets come from env only — never committed."""
import os
from pathlib import Path

from dotenv import load_dotenv

# Load a local .env if present (no-op on Railway, where vars are injected).
load_dotenv()

BASE_DIR = Path(__file__).resolve().parent.parent  # backend/


def _database_url() -> str:
    url = os.getenv("DATABASE_URL")
    if not url:
        # Local dev fallback: SQLite file next to the backend.
        return f"sqlite:///{BASE_DIR / 'office_heat.sqlite3'}"
    # Railway / Heroku sometimes provide postgres:// which SQLAlchemy no longer accepts.
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql://", 1)
    return url


DATABASE_URL = _database_url()

APP_PASSWORD = os.getenv("APP_PASSWORD", "").strip()
SECRET_KEY = os.getenv("SECRET_KEY", "dev-insecure-secret-change-me")

ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "").strip()
ANTHROPIC_MODEL = os.getenv("ANTHROPIC_MODEL", "claude-opus-4-8").strip()

GARMIN_EMAIL = os.getenv("GARMIN_EMAIL", "").strip()
GARMIN_PASSWORD = os.getenv("GARMIN_PASSWORD", "").strip()
# Pre-generated garth session token (base64 of garth Client.dumps()). Lets us
# auth without a headless login, sidestepping MFA. Same format ripe_fitness uses,
# and it's account-level, so an existing GARMIN_TOKENS_B64 can be reused as-is.
GARMIN_TOKENS_B64 = os.getenv("GARMIN_TOKENS_B64", "").strip()

DEFAULT_FTP = int(os.getenv("DEFAULT_FTP", "200"))

# When no password is configured the app is open (local dev convenience).
AUTH_ENABLED = bool(APP_PASSWORD)

# Where the built frontend lives (frontend/dist), served by FastAPI in production.
FRONTEND_DIST = BASE_DIR.parent / "frontend" / "dist"
