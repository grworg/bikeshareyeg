"""
Transit, cycling, and POI overlay layers.

Fetches LRT lines, bike paths, bus routes, and point-of-interest data
from the Overpass API and returns GeoJSON FeatureCollections.  Results
use the same permanent disk cache as the planner (data/overpass_cache/)
so the app works even when outbound HTTP is unavailable (e.g. Docker on
restricted networks).

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
    "motorway": f"""
[out:json][timeout:30];
(
  way["highway"="motorway"]({BBOX});
  way["highway"="motorway_link"]({BBOX});
);
out geom;
""",
    "trunk": f"""
[out:json][timeout:30];
(
  way["highway"="trunk"]({BBOX});
  way["highway"="trunk_link"]({BBOX});
);
out geom;
""",
}

# POI overlay queries — use `out center;` so ways/relations return a single
# centroid point instead of full geometry (much smaller payloads).
POI_QUERIES: dict[str, str] = {
    "commercial": f"""
[out:json][timeout:120];
(
  node["shop"]({BBOX});
  way["shop"]({BBOX});
  node["amenity"~"^(restaurant|cafe|fast_food|bar|bank|pharmacy|marketplace|clinic|dentist)$"]({BBOX});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|bank|pharmacy|marketplace|clinic|dentist)$"]({BBOX});
);
out center;
""",
    "education": f"""
[out:json][timeout:60];
(
  node["amenity"~"^(university|college|school|library)$"]({BBOX});
  way["amenity"~"^(university|college|school|library)$"]({BBOX});
  relation["amenity"~"^(university|college|school|library)$"]({BBOX});
);
out center;
""",
    "recreation": f"""
[out:json][timeout:90];
(
  node["leisure"~"^(park|sports_centre|fitness_centre|swimming_pool|playground)$"]({BBOX});
  way["leisure"~"^(park|sports_centre|fitness_centre|swimming_pool|playground)$"]({BBOX});
  relation["leisure"="park"]({BBOX});
  node["amenity"="community_centre"]({BBOX});
  way["amenity"="community_centre"]({BBOX});
);
out center;
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
    keep = ("name", "highway", "railway", "cycleway", "bicycle", "surface", "ref", "operator", "maxspeed")
    return {k: v for k, v in tags.items() if k in keep}


def _pick_poi_tags(tags: dict) -> dict:
    """Keep POI-relevant tags for tooltips."""
    keep = ("name", "shop", "amenity", "leisure", "cuisine", "brand")
    return {k: v for k, v in tags.items() if k in keep}


def _overpass_centers_to_geojson(data: dict, layer: str) -> dict:
    """Convert an Overpass `out center;` response to a GeoJSON Point collection.

    Handles:
      - nodes  → lat/lon directly
      - ways/relations → center.lat / center.lon
    """
    features: list[dict[str, Any]] = []
    seen_ids: set[int] = set()

    for elem in data.get("elements", []):
        eid = elem.get("id", 0)
        if eid in seen_ids:
            continue
        seen_ids.add(eid)

        tags = elem.get("tags", {})
        lat: float | None = None
        lon: float | None = None

        if elem.get("type") == "node" and "lat" in elem and "lon" in elem:
            lat, lon = elem["lat"], elem["lon"]
        elif elem.get("center"):
            c = elem["center"]
            if "lat" in c and "lon" in c:
                lat, lon = c["lat"], c["lon"]

        if lat is not None and lon is not None:
            features.append({
                "type": "Feature",
                "properties": {"id": eid, "layer": layer, **_pick_poi_tags(tags)},
                "geometry": {"type": "Point", "coordinates": [lon, lat]},
            })

    return {"type": "FeatureCollection", "features": features}


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


@router.get("/motorway")
def overlay_motorway():
    """Motorways and motorway links (freeways, on/off ramps) — excluded from cycling graph."""
    return _get_overlay("motorway")


@router.get("/trunk")
def overlay_trunk():
    """Trunk roads and trunk links (high-speed arterials) — excluded from cycling graph."""
    return _get_overlay("trunk")


# ---------------------------------------------------------------------------
# POI overlay endpoints
# ---------------------------------------------------------------------------


def _get_poi_overlay(name: str) -> dict:
    """Get a POI GeoJSON overlay, using disk cache for Overpass data."""
    if name in _geojson_cache:
        return _geojson_cache[name]

    query = POI_QUERIES.get(name)
    if not query:
        raise HTTPException(status_code=400, detail=f"Unknown POI overlay: {name}")

    try:
        data = _overpass_query_cached(query)
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Overpass data unavailable for {name}: {exc}",
        )

    geojson = _overpass_centers_to_geojson(data, name)
    _geojson_cache[name] = geojson
    return geojson


@router.get("/commercial")
def overlay_commercial():
    """Shops, restaurants, cafes, and services in Edmonton."""
    return _get_poi_overlay("commercial")


@router.get("/education")
def overlay_education():
    """Schools, universities, colleges, and libraries in Edmonton."""
    return _get_poi_overlay("education")


@router.get("/recreation")
def overlay_recreation():
    """Parks, rec centres, sports facilities, and pools in Edmonton."""
    return _get_poi_overlay("recreation")


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
