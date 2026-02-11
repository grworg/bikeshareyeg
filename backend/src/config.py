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
    debug: bool = True
    host: str = "0.0.0.0"
    port: int = 8000

    # Edmonton Open Data app token (optional, increases rate limits)
    edmonton_app_token: str | None = None

    # H3 resolution for hex binning (7 = ~5.16 km², 8 = ~0.74 km², 9 = ~0.105 km²)
    h3_resolution: int = 9

    model_config = {"env_file": str(PROJECT_ROOT / ".env"), "env_prefix": "BIKESHARE_"}


settings = Settings()
