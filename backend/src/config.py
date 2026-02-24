"""Application configuration and constants."""

from pathlib import Path

from pydantic_settings import BaseSettings

# Project paths
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
DATA_DIR = PROJECT_ROOT / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
CACHE_DIR = DATA_DIR / "cache"

# Edmonton bounding box and center
EDMONTON_CENTER = (53.5461, -113.4937)  # lat, lon
EDMONTON_PLACE = "Edmonton, Alberta, Canada"

# Edmonton Open Data Portal
EDMONTON_OPEN_DATA_BASE = "https://data.edmonton.ca/resource"
EDMONTON_DATASETS = {
    "bike_network": "7cicr-bblx",       # Bike network infrastructure
    "traffic_volumes": "tq23-qn4m",     # Traffic volumes
    "road_network": "7ae6-qkug",        # Road network
    "neighbourhoods": "65fr-66s6",       # Neighbourhood boundaries
    "transit_stops": "mhsg-gf76",       # ETS transit stops
    "traffic_signals": "bpip-uppu",     # Traffic signals
}

# EPSG codes
WGS84 = "EPSG:4326"
UTM_12N = "EPSG:32612"  # Edmonton is in UTM zone 12N


class Settings(BaseSettings):
    """App settings, loaded from environment / .env file."""

    app_name: str = "BikeShareYEG"

    # --- Deployment mode ---
    debug: bool = False  # True enables Swagger docs + verbose errors
    host: str = "127.0.0.1"  # bind to loopback; Caddy proxies from outside
    port: int = 8000

    # --- CORS ---
    # Comma-separated allowed origins.  "*" allows all (not recommended).
    allowed_origins: str = "http://localhost:3000,http://localhost:3001"

    # --- Session / multi-tenancy ---
    # Max concurrent sessions kept in memory (oldest evicted via LRU)
    max_sessions: int = 200
    # Session cookie name
    session_cookie: str = "bsyeg_sid"
    # Session lifetime in seconds (default 24 h)
    session_ttl_s: int = 86400

    # --- Rate limiting ---
    # Format: "N/period" — e.g. "5/minute", "60/minute"
    rate_limit_optimize: str = "3/minute"
    rate_limit_step: str = "20/minute"
    rate_limit_routes: str = "15/minute"
    rate_limit_default: str = "60/minute"

    # --- Planner caps ---
    max_num_stations: int = 100
    max_existing_stations: int = 200

    # --- Edmonton Open Data ---
    edmonton_app_token: str | None = None

    # H3 resolution for hex binning (7 = ~5.16 km², 8 = ~0.74 km², 9 = ~0.105 km²)
    h3_resolution: int = 9

    # --- Database (network sharing) ---
    database_url: str = ""
    rate_limit_share_create: str = "5/hour"
    rate_limit_share_read: str = "60/minute"
    max_network_payload_kb: int = 500

    model_config = {"env_file": str(PROJECT_ROOT / ".env"), "env_prefix": "BIKESHARE_"}


settings = Settings()
