"""
Transit and cycling infrastructure overlay layers.

Fetches LRT lines, bike paths, and bus routes from the Overpass API
and returns GeoJSON FeatureCollections.  Results use the same permanent
disk cache as the planner (data/overpass_cache/) so the app works even
when outbound HTTP is unavailable (e.g. Docker on restricted networks).

Also serves pre-processed population density choropleth data generated
by scripts/process-census-data.py from 2021 Federal Census data.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import APIRouter, HTTPException

from src.optimization.planner import _overpass_query_cached

router = APIRouter(prefix="/api/overlays", tags=["overlays"])

# Edmonton bounding box (south, west, north, east)
BBOX = "53.35,-113.75,53.70,-113.25"

# GeoJSON results are cached in-memory after first conversion
_geojson_cache: dict[str, dict] = {}

# ---------------------------------------------------------------------------
# Overpass queries
# ---------------------------------------------------------------------------

QUERIES: dict[str, str] = {
    "lrt": f"""
[out:json][timeout:30];
(
  way["railway"="light_rail"]({BBOX});
  way["railway"="subway"]({BBOX});
  node["railway"="station"]["station"="light_rail"]({BBOX});
  node["railway"="station"]["station"="subway"]({BBOX});
);
out geom;
""",
    # Dedicated cycling infrastructure only — skip painted on-road lanes
    # (those cause Overpass timeouts due to matching thousands of road ways).
    "bike": f"""
[out:json][timeout:60];
(
  way["highway"="cycleway"]({BBOX});
  way["highway"="path"]["bicycle"="designated"]({BBOX});
  way["highway"="footway"]["bicycle"="designated"]({BBOX});
  way["cycleway"="track"]["highway"]({BBOX});
  way["cycleway"="separate"]["highway"]({BBOX});
);
out geom;
""",
    "bus": f"""
[out:json][timeout:120];
relation["route"="bus"]({BBOX});
way(r)({BBOX});
out geom;
""",
}

# ---------------------------------------------------------------------------
# Conversion helpers
# ---------------------------------------------------------------------------


def _overpass_ways_to_geojson(data: dict, layer: str) -> dict:
    """Convert Overpass 'out geom' response to a GeoJSON FeatureCollection."""
    features: list[dict[str, Any]] = []
    seen_ids: set[int] = set()

    for elem in data.get("elements", []):
        eid = elem.get("id", 0)
        if eid in seen_ids:
            continue
        seen_ids.add(eid)

        etype = elem.get("type")
        tags = elem.get("tags", {})

        if etype == "way" and "geometry" in elem:
            coords = [[n["lon"], n["lat"]] for n in elem["geometry"]]
            if len(coords) < 2:
                continue
            features.append({
                "type": "Feature",
                "properties": {"id": eid, "layer": layer, **_pick_tags(tags)},
                "geometry": {"type": "LineString", "coordinates": coords},
            })

        elif etype == "node" and "lat" in elem and "lon" in elem:
            features.append({
                "type": "Feature",
                "properties": {"id": eid, "layer": layer, **_pick_tags(tags)},
                "geometry": {"type": "Point", "coordinates": [elem["lon"], elem["lat"]]},
            })

    return {"type": "FeatureCollection", "features": features}


def _pick_tags(tags: dict) -> dict:
    """Keep a small subset of tags for the frontend tooltip."""
    keep = ("name", "highway", "railway", "cycleway", "bicycle", "surface", "ref", "operator")
    return {k: v for k, v in tags.items() if k in keep}


# ---------------------------------------------------------------------------
# Cached fetcher
# ---------------------------------------------------------------------------


def _get_overlay(name: str) -> dict:
    """Get a GeoJSON overlay, using the shared disk cache for Overpass data."""
    if name in _geojson_cache:
        return _geojson_cache[name]

    query = QUERIES.get(name)
    if not query:
        raise HTTPException(status_code=400, detail=f"Unknown overlay: {name}")

    try:
        data = _overpass_query_cached(query)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Overpass data unavailable for {name}: {exc}",
        )

    geojson = _overpass_ways_to_geojson(data, name)
    _geojson_cache[name] = geojson
    return geojson


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/lrt")
def overlay_lrt():
    """LRT / subway lines and stations in Edmonton."""
    return _get_overlay("lrt")


@router.get("/bike")
def overlay_bike():
    """Cycling infrastructure: cycleways, bike lanes, shared paths."""
    return _get_overlay("bike")


@router.get("/bus")
def overlay_bus():
    """Bus route way segments (deduplicated) in Edmonton."""
    return _get_overlay("bus")


# ---------------------------------------------------------------------------
# Static pre-processed overlays (population density, etc.)
# ---------------------------------------------------------------------------

_OVERLAYS_DIR = Path(__file__).resolve().parents[3] / "data" / "overlays"

_static_cache: dict[str, dict] = {}


def _get_static_overlay(name: str) -> dict:
    """Read a pre-processed GeoJSON overlay from disk (cached in-memory)."""
    if name in _static_cache:
        return _static_cache[name]

    filepath = _OVERLAYS_DIR / f"{name}.geojson"
    if not filepath.exists():
        raise HTTPException(
            status_code=404,
            detail=f"Overlay data not found: {name}. Run scripts/process-census-data.py first.",
        )

    with open(filepath) as f:
        data = json.load(f)

    _static_cache[name] = data
    return data


@router.get("/population")
def overlay_population():
    """Population density by neighbourhood (2021 Federal Census)."""
    return _get_static_overlay("population_density")
