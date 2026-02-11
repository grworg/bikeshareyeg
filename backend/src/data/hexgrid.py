"""
H3 hexagonal grid utilities for spatial demand aggregation.

Uses Uber's H3 hierarchical hexagonal grid to:
  - Aggregate demand/population into hex cells
  - Generate candidate station locations at hex centroids
  - Score cells by accessibility, demand potential, etc.
"""

from __future__ import annotations

import geopandas as gpd
import h3
import numpy as np
import pandas as pd
from shapely.geometry import Polygon

from src.config import settings, WGS84


def polygon_to_h3(gdf: gpd.GeoDataFrame, resolution: int | None = None) -> set[str]:
    """
    Convert a GeoDataFrame of polygons to a set of H3 hex indices that cover them.
    """
    resolution = resolution or settings.h3_resolution
    hex_ids = set()
    for geom in gdf.to_crs(WGS84).geometry:
        coords = list(geom.exterior.coords)
        # h3.polyfill expects (lat, lng) tuples
        poly = h3.LatLngPoly([(lat, lng) for lng, lat in coords])
        hex_ids.update(h3.polygon_to_cells(poly, resolution))
    return hex_ids


def h3_to_geodataframe(hex_ids: set[str]) -> gpd.GeoDataFrame:
    """Convert a set of H3 hex IDs to a GeoDataFrame of hex polygons."""
    records = []
    for h in hex_ids:
        boundary = h3.cell_to_boundary(h)
        # boundary returns (lat, lng) tuples; Shapely needs (lng, lat)
        poly = Polygon([(lng, lat) for lat, lng in boundary])
        lat, lng = h3.cell_to_latlng(h)
        records.append({"h3_index": h, "geometry": poly, "lat": lat, "lng": lng})

    return gpd.GeoDataFrame(records, crs=WGS84)


def generate_hex_grid(
    boundary_gdf: gpd.GeoDataFrame,
    resolution: int | None = None,
) -> gpd.GeoDataFrame:
    """
    Generate a complete H3 hex grid covering the given boundary.

    Returns a GeoDataFrame where each row is one hex cell with its
    H3 index, centroid lat/lng, and polygon geometry.
    """
    hex_ids = polygon_to_h3(boundary_gdf, resolution)
    return h3_to_geodataframe(hex_ids)


def aggregate_points_to_hex(
    points_gdf: gpd.GeoDataFrame,
    resolution: int | None = None,
    value_column: str | None = None,
) -> pd.DataFrame:
    """
    Aggregate point features into H3 hex cells.

    Returns a DataFrame with columns: h3_index, count, [sum of value_column].
    """
    resolution = resolution or settings.h3_resolution
    points = points_gdf.to_crs(WGS84)

    hex_indices = [
        h3.latlng_to_cell(row.geometry.y, row.geometry.x, resolution)
        for _, row in points.iterrows()
    ]
    points = points.copy()
    points["h3_index"] = hex_indices

    agg = {"h3_index": "count"}
    if value_column and value_column in points.columns:
        agg[value_column] = "sum"

    result = points.groupby("h3_index").agg(**{
        "count": ("h3_index", "size"),
        **({"value_sum": (value_column, "sum")} if value_column else {}),
    }).reset_index()

    return result
