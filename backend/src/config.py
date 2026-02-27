"""Application configuration and constants."""

from pathlib import Path

from pydantic_settings import BaseSettings

from src.city_loader import load_city_config

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
CACHE_DIR = DATA_DIR / "cache"

# City configuration (loaded from cities/{BIKESHARE_CITY}.yaml)
city = load_city_config()

# EPSG codes
WGS84 = "EPSG:4326"


class Settings(BaseSettings):
    """App settings, loaded from environment / .env file."""

    app_name: str = city.app_name

    # --- Deployment mode ---
    debug: bool = False
    host: str = "127.0.0.1"
    port: int = 8000

    # --- CORS ---
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    # --- Session / multi-tenancy ---
    max_sessions: int = 200
    session_cookie: str = city.session_cookie
    session_ttl_s: int = 86400

    # --- Rate limiting ---
    rate_limit_optimize: str = "3/minute"
    rate_limit_step: str = "20/minute"
    rate_limit_routes: str = "15/minute"
    rate_limit_default: str = "60/minute"

    # --- Planner caps ---
    max_num_stations: int = 100
    max_existing_stations: int = 200

    # --- City open data portal token (optional) ---
    open_data_app_token: str | None = None

    # H3 resolution for hex binning
    h3_resolution: int = 9

    # --- Database (network sharing) ---
    database_url: str = ""
    rate_limit_share_create: str = "5/hour"
    rate_limit_share_read: str = "60/minute"
    max_network_payload_kb: int = 500

    model_config = {"env_file": str(PROJECT_ROOT / ".env"), "env_prefix": "BIKESHARE_"}


settings = Settings()
