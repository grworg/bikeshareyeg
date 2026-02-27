"""Load and validate city configuration from YAML."""

from __future__ import annotations

import os
from functools import lru_cache
from math import cos, radians
from pathlib import Path

import yaml
from pydantic import BaseModel, Field

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
CITIES_DIR = PROJECT_ROOT / "cities"


# ── Pydantic models ────────────────────────────────────────


class CenterConfig(BaseModel):
    lat: float
    lng: float


class BboxConfig(BaseModel):
    south: float
    west: float
    north: float
    east: float

    @property
    def overpass_str(self) -> str:
        """Bounding box formatted for Overpass API queries: south,west,north,east."""
        return f"{self.south},{self.west},{self.north},{self.east}"

    @property
    def as_tuple(self) -> tuple[float, float, float, float]:
        return (self.south, self.west, self.north, self.east)


class TransitConfig(BaseModel):
    rapid_transit_label: str = "LRT"
    rapid_transit_route_types: list[int] = [0]
    rapid_transit_color: str = "#7b1fa2"
    gtfs_path: str = "data/gtfs/gtfs.zip"
    osm_extract_url: str = ""
    osm_filename: str = ""


class PopulationConfig(BaseModel):
    provider: str = "geojson"
    statscan_cma_code: str | None = None
    fips_county_codes: list[str] = Field(default_factory=list)


class FactorLabelsConfig(BaseModel):
    lrt: str = "LRT"
    bike_infra: str = "Bike Infra"
    transit: str = "Transit"
    commercial: str = "Commercial"
    education: str = "Education"
    recreation: str = "Recreation"
    population: str = "Population"


class CityConfig(BaseModel):
    """Complete city configuration, validated from YAML."""

    name: str
    short_code: str
    region: str
    app_name: str
    tagline: str
    description: str
    site_url: str = ""

    center: CenterConfig
    bbox: BboxConfig
    initial_zoom: float = 11.5
    utm_epsg: int = 32612
    reference_latitude: float = 53.5

    transit: TransitConfig = Field(default_factory=TransitConfig)
    population: PopulationConfig = Field(default_factory=PopulationConfig)
    factor_labels: FactorLabelsConfig = Field(default_factory=FactorLabelsConfig)

    # ── Computed helpers ────────────────────────────────────

    @property
    def lat_m(self) -> float:
        """Metres per degree of latitude (roughly constant ~111 320 m)."""
        return 111_320.0

    @property
    def lng_m(self) -> float:
        """Metres per degree of longitude at this city's reference latitude."""
        return 111_320.0 * cos(radians(self.reference_latitude))

    @property
    def utm_crs(self) -> str:
        return f"EPSG:{self.utm_epsg}"

    @property
    def session_cookie(self) -> str:
        return f"bs{self.short_code.lower()}_sid"

    @property
    def center_tuple(self) -> tuple[float, float]:
        return (self.center.lat, self.center.lng)


# ── Loader ──────────────────────────────────────────────────


@lru_cache(maxsize=1)
def load_city_config() -> CityConfig:
    """Load the city configuration selected by BIKESHARE_CITY env var.

    Looks for cities/{city_name}.yaml relative to the project root.
    Defaults to 'edmonton' if BIKESHARE_CITY is not set.
    """
    city_name = os.environ.get("BIKESHARE_CITY", "edmonton").strip().lower()
    yaml_path = CITIES_DIR / f"{city_name}.yaml"
    if not yaml_path.exists():
        raise FileNotFoundError(
            f"City config not found: {yaml_path}\n"
            f"Available cities: {[p.stem for p in CITIES_DIR.glob('*.yaml')]}"
        )
    with open(yaml_path) as f:
        raw = yaml.safe_load(f)
    return CityConfig(**raw)
