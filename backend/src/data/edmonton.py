"""
Fetch and process Edmonton open data.

Data sources:
  - City of Edmonton Open Data Portal (data.edmonton.ca)
  - OpenStreetMap via OSMnx
  - Statistics Canada census data
"""

from __future__ import annotations

import json
from pathlib import Path

import geopandas as gpd
import httpx
import osmnx as ox
import pandas as pd

from src.config import (
    CACHE_DIR,
    EDMONTON_DATASETS,
    EDMONTON_OPEN_DATA_BASE,
    EDMONTON_PLACE,
    RAW_DATA_DIR,
    UTM_12N,
    WGS84,
    settings,
)


# ---------------------------------------------------------------------------
# OpenStreetMap data via OSMnx
# ---------------------------------------------------------------------------

def fetch_bike_network(use_cache: bool = True) -> gpd.GeoDataFrame:
    """
    Fetch Edmonton's cycling-usable street network from OpenStreetMap.

    Returns a GeoDataFrame of edges (street segments) with cycling attributes.
    """
    cache_path = CACHE_DIR / "osm_bike_network.parquet"
    if use_cache and cache_path.exists():
        return gpd.read_parquet(cache_path)

    # Fetch the full bike-able network
    G = ox.graph_from_place(EDMONTON_PLACE, network_type="bike")
    # Convert to GeoDataFrames (nodes and edges)
    nodes, edges = ox.graph_to_gdfs(G)

    edges = edges.reset_index()
    edges.to_parquet(cache_path)
    return edges


def fetch_drive_network(use_cache: bool = True) -> gpd.GeoDataFrame:
    """Fetch Edmonton's drivable street network from OSM."""
    cache_path = CACHE_DIR / "osm_drive_network.parquet"
    if use_cache and cache_path.exists():
        return gpd.read_parquet(cache_path)

    G = ox.graph_from_place(EDMONTON_PLACE, network_type="drive")
    nodes, edges = ox.graph_to_gdfs(G)
    edges = edges.reset_index()
    edges.to_parquet(cache_path)
    return edges


def fetch_osm_graph(network_type: str = "bike"):
    """
    Return the raw NetworkX graph for Edmonton from OSM.

    Useful for routing and network analysis.
    """
    return ox.graph_from_place(EDMONTON_PLACE, network_type=network_type)


def fetch_pois(tags: dict | None = None, use_cache: bool = True) -> gpd.GeoDataFrame:
    """
    Fetch points of interest from OSM for Edmonton.

    Default tags pull common bike-trip generators: transit, commercial, education, parks.
    """
    if tags is None:
        tags = {
            "amenity": [
                "university", "college", "school", "library",
                "cafe", "restaurant", "bar", "marketplace",
            ],
            "shop": True,
            "leisure": ["park", "fitness_centre", "sports_centre"],
            "public_transport": ["station", "stop_position"],
        }

    cache_path = CACHE_DIR / "osm_pois.parquet"
    if use_cache and cache_path.exists():
        return gpd.read_parquet(cache_path)

    pois = ox.features_from_place(EDMONTON_PLACE, tags=tags)
    # Keep only points and polygons (convert polygons to centroids)
    pois = pois.to_crs(WGS84)
    pois.to_parquet(cache_path)
    return pois


# ---------------------------------------------------------------------------
# City of Edmonton Open Data Portal
# ---------------------------------------------------------------------------

def _fetch_socrata(dataset_id: str, limit: int = 50000, **params) -> pd.DataFrame:
    """Fetch data from Edmonton's Socrata-based open data portal."""
    url = f"{EDMONTON_OPEN_DATA_BASE}/{dataset_id}.json"
    headers = {}
    if settings.edmonton_app_token:
        headers["X-App-Token"] = settings.edmonton_app_token

    params["$limit"] = limit
    resp = httpx.get(url, params=params, headers=headers, timeout=60)
    resp.raise_for_status()
    return pd.DataFrame(resp.json())


def fetch_neighbourhoods(use_cache: bool = True) -> gpd.GeoDataFrame:
    """Fetch Edmonton neighbourhood boundaries."""
    cache_path = CACHE_DIR / "neighbourhoods.parquet"
    if use_cache and cache_path.exists():
        return gpd.read_parquet(cache_path)

    gdf = ox.features_from_place(
        EDMONTON_PLACE,
        tags={"admin_level": "10", "boundary": "administrative"},
    )
    gdf = gdf.to_crs(WGS84)
    gdf.to_parquet(cache_path)
    return gdf


def fetch_traffic_volumes(use_cache: bool = True) -> pd.DataFrame:
    """Fetch traffic volume counts from Edmonton Open Data."""
    cache_path = CACHE_DIR / "traffic_volumes.parquet"
    if use_cache and cache_path.exists():
        return pd.read_parquet(cache_path)

    df = _fetch_socrata(EDMONTON_DATASETS["traffic_volumes"])
    df.to_parquet(cache_path)
    return df


def fetch_bike_infrastructure(use_cache: bool = True) -> pd.DataFrame:
    """Fetch Edmonton's official bike infrastructure dataset."""
    cache_path = CACHE_DIR / "bike_infrastructure.parquet"
    if use_cache and cache_path.exists():
        return pd.read_parquet(cache_path)

    df = _fetch_socrata(EDMONTON_DATASETS["bike_network"])
    df.to_parquet(cache_path)
    return df


# ---------------------------------------------------------------------------
# Utilities
# ---------------------------------------------------------------------------

def get_edmonton_boundary() -> gpd.GeoDataFrame:
    """Get Edmonton's city boundary polygon."""
    return ox.geocode_to_gdf(EDMONTON_PLACE)


def save_geojson(gdf: gpd.GeoDataFrame, name: str, output_dir: Path | None = None):
    """Export a GeoDataFrame as GeoJSON for the frontend."""
    output_dir = output_dir or (CACHE_DIR / "geojson")
    output_dir.mkdir(parents=True, exist_ok=True)
    path = output_dir / f"{name}.geojson"
    gdf.to_crs(WGS84).to_file(path, driver="GeoJSON")
    return path
