"""
Pluggable population data providers.

Each provider implements the same interface: given a bounding box and output
path, produce a ``population_density.geojson`` with a ``density`` property
per feature (people / km²).

The active provider is selected by the city config's ``population.provider``
field:
  - "statscan"   — Canadian cities (StatsCan 2021 Census DA boundaries)
  - "us_census"  — US cities (ACS 5-year + TIGER/Line)
  - "geojson"    — Pre-supplied file, no generation needed
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from pathlib import Path

from src.city_loader import CityConfig


class PopulationProvider(ABC):
    """Base class for population data generation."""

    @abstractmethod
    def generate(self, cfg: CityConfig, output_path: Path) -> None:
        """Fetch / process population data and write GeoJSON to output_path.

        The output GeoJSON must be a FeatureCollection where each feature has
        at minimum a ``density`` property (people / km²).
        """


class StatsCanProvider(PopulationProvider):
    """Canadian cities — uses StatsCan 2021 Census DA boundaries.

    Requires ``population.statscan_cma_code`` in the city config.
    """

    def generate(self, cfg: CityConfig, output_path: Path) -> None:
        cma_code = cfg.population.statscan_cma_code
        if not cma_code:
            raise ValueError(
                "StatsCanProvider requires population.statscan_cma_code in city config"
            )
        # Delegate to the existing process-census-data logic
        from scripts._statscan import process_da_level

        geojson = process_da_level(cma_code=cma_code, utm_epsg=cfg.utm_epsg)
        import json

        output_path.parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w") as f:
            json.dump(geojson, f, separators=(",", ":"))
        print(f"[StatsCanProvider] Wrote {len(geojson['features'])} features to {output_path}")


class USCensusProvider(PopulationProvider):
    """US cities — uses ACS 5-year estimates + TIGER/Line block group boundaries.

    Requires ``population.fips_county_codes`` in the city config.

    NOTE: This is a reference implementation stub. Community contributors
    should implement the actual Census API + TIGER/Line fetching.
    """

    def generate(self, cfg: CityConfig, output_path: Path) -> None:
        fips = cfg.population.fips_county_codes
        if not fips:
            raise ValueError(
                "USCensusProvider requires population.fips_county_codes in city config"
            )
        raise NotImplementedError(
            "USCensusProvider is not yet implemented. "
            "See PORTING.md for how to supply a pre-built GeoJSON instead, "
            "or contribute an implementation!"
        )


class PrebuiltGeoJSONProvider(PopulationProvider):
    """For cities that supply their own population_density.geojson.

    This is a no-op — the file is expected to already exist at output_path.
    """

    def generate(self, cfg: CityConfig, output_path: Path) -> None:
        if not output_path.exists():
            raise FileNotFoundError(
                f"PrebuiltGeoJSONProvider expects {output_path} to already exist. "
                "Place your population_density.geojson there manually."
            )
        print(f"[PrebuiltGeoJSONProvider] Using existing {output_path}")


def get_provider(provider_name: str) -> PopulationProvider:
    """Factory: return the right provider for a given name."""
    providers: dict[str, type[PopulationProvider]] = {
        "statscan": StatsCanProvider,
        "us_census": USCensusProvider,
        "geojson": PrebuiltGeoJSONProvider,
    }
    cls = providers.get(provider_name)
    if cls is None:
        raise ValueError(
            f"Unknown population provider: {provider_name!r}. "
            f"Valid: {list(providers.keys())}"
        )
    return cls()
