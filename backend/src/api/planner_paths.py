"""
Planner path exploration — on-demand Dijkstra shortest-path computation.

Lets users visualise the actual road-network route that underlies a hex's
proximity / density score for a given suitability factor.

Architecture:
  - The road graph (GraphML) and feature reference points are loaded lazily
    on first request and cached for the lifetime of the process.
  - Each request runs a single-source Dijkstra from the hex's snapped graph
    node, then traces the shortest path back to the nearest feature node.
  - The returned GeoJSON contains:
      • A LineString of the actual route
      • A Point for the destination feature
      • Metadata (distance, factor key, feature name)

Endpoint:
  GET /api/planner/hex-path?h3={hex_id}&factor={factor_key}
"""

from __future__ import annotations

import hashlib
import json
import math
import time
from collections import Counter
from pathlib import Path
from typing import Any

import h3
import numpy as np
from fastapi import APIRouter, HTTPException, Query

from src.config import settings, city

router = APIRouter(prefix="/api/planner", tags=["planner"])

# ---------------------------------------------------------------------------
# Paths — derived from city config
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[3]
_code = city.short_code.lower()
GRAPH_PKL_PATH = PROJECT_ROOT / "data" / "cache" / f"{_code}_road_graph_minimal.pkl"
GRAPH_GRAPHML_PATH = PROJECT_ROOT / "data" / "cache" / f"{_code}_road_graph.graphml"
OVERPASS_CACHE_DIR = PROJECT_ROOT / "data" / "overpass_cache"

BBOX_STR = city.bbox.overpass_str
LAT_M = city.lat_m
LNG_M = city.lng_m


# ---------------------------------------------------------------------------
# Factor definitions (mirrors precompute-hexgrid.py — single source of truth
# for the Overpass queries that define each factor's reference features).
# ---------------------------------------------------------------------------

FACTOR_DEFS: dict[str, dict[str, Any]] = {
    "lrt": {
        "name": f"{city.transit.rapid_transit_label} Station",
        "extract": "points",
        "max_dist_m": 5000.0,
        "query": f"""
[out:json][timeout:90];
(
  node["railway"="station"]["station"="light_rail"]({BBOX_STR});
  node["railway"="station"]["station"="subway"]({BBOX_STR});
);
out body;
""",
    },
    "bike_infra": {
        "name": "Bike Infrastructure",
        "extract": "line_samples",
        "sample_interval_m": 100.0,
        "max_dist_m": 3000.0,
        "query": f"""
[out:json][timeout:60];
(
  way["highway"="cycleway"]({BBOX_STR});
  way["highway"="path"]["bicycle"="designated"]({BBOX_STR});
  way["cycleway"="track"]["highway"]({BBOX_STR});
);
out geom;
""",
    },
    "transit": {
        "name": "Transit Stop",
        "extract": "points",
        "max_dist_m": 2000.0,
        "query": f"""
[out:json][timeout:60];
(
  node["highway"="bus_stop"]({BBOX_STR});
  node["public_transport"="stop_position"]["bus"="yes"]({BBOX_STR});
  node["railway"="station"]["station"="light_rail"]({BBOX_STR});
);
out body;
""",
    },
    "commercial": {
        "name": "Commercial / Retail",
        "extract": "centers",
        "max_dist_m": 2000.0,
        "query": f"""
[out:json][timeout:120];
(
  node["shop"]({BBOX_STR});
  way["shop"]({BBOX_STR});
  node["amenity"~"^(restaurant|cafe|fast_food|bar|bank|pharmacy|marketplace|clinic|dentist)$"]({BBOX_STR});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|bank|pharmacy|marketplace|clinic|dentist)$"]({BBOX_STR});
);
out center;
""",
    },
    "education": {
        "name": "Education / Institutional",
        "extract": "centers",
        "max_dist_m": 3000.0,
        "query": f"""
[out:json][timeout:60];
(
  node["amenity"~"^(university|college|school|library)$"]({BBOX_STR});
  way["amenity"~"^(university|college|school|library)$"]({BBOX_STR});
  relation["amenity"~"^(university|college|school|library)$"]({BBOX_STR});
);
out center;
""",
    },
    "recreation": {
        "name": "Parks / Recreation",
        "extract": "centers",
        "max_dist_m": 2500.0,
        "query": f"""
[out:json][timeout:90];
(
  node["leisure"~"^(park|sports_centre|fitness_centre|swimming_pool|playground)$"]({BBOX_STR});
  way["leisure"~"^(park|sports_centre|fitness_centre|swimming_pool|playground)$"]({BBOX_STR});
  relation["leisure"="park"]({BBOX_STR});
  node["amenity"="community_centre"]({BBOX_STR});
  way["amenity"="community_centre"]({BBOX_STR});
);
out center;
""",
    },
}


# ---------------------------------------------------------------------------
# Lazy singletons
# ---------------------------------------------------------------------------

_graph: Any = None
_ref_nodes: dict[str, set[int]] = {}          # factor key → set of graph node IDs
_ref_coords: dict[str, dict[int, tuple[float, float]]] = {}  # node_id → (lat, lng)


def _load_graph() -> Any:
    """Load the road graph — prefers the minimal pickle (~26 MB, <1s),
    falls back to full GraphML (~200 MB, ~23s) if pickle isn't available."""
    global _graph
    if _graph is not None:
        return _graph

    import pickle

    t0 = time.time()

    if GRAPH_PKL_PATH.exists():
        with open(GRAPH_PKL_PATH, "rb") as f:
            _graph = pickle.load(f)
        print(f"[planner_paths] Loaded minimal graph: "
              f"{_graph.number_of_nodes():,} nodes, "
              f"{_graph.number_of_edges():,} edges ({time.time() - t0:.1f}s)")
        return _graph

    if GRAPH_GRAPHML_PATH.exists():
        import osmnx as ox
        _graph = ox.load_graphml(GRAPH_GRAPHML_PATH)
        print(f"[planner_paths] Loaded GraphML (slow path): "
              f"{_graph.number_of_nodes():,} nodes, "
              f"{_graph.number_of_edges():,} edges ({time.time() - t0:.1f}s)")
        return _graph

    raise FileNotFoundError(
        f"Road graph not found at {GRAPH_PKL_PATH} or {GRAPH_GRAPHML_PATH}. "
        "Run `make hexgrid` to precompute the graph."
    )


def _overpass_cached(query: str) -> dict:
    """Read from the permanent Overpass disk cache (read-only)."""
    cache_key = hashlib.sha256(query.strip().encode()).hexdigest()[:16]
    cache_path = OVERPASS_CACHE_DIR / f"{cache_key}.json"
    if not cache_path.exists():
        raise FileNotFoundError(
            f"Overpass cache miss for {cache_key}. "
            "Run `make hexgrid` to populate the cache."
        )
    return json.loads(cache_path.read_text())


def _extract_points(data: dict) -> list[tuple[float, float]]:
    """Extract (lat, lng) tuples from Overpass node results."""
    pts = []
    for elem in data.get("elements", []):
        if elem.get("type") == "node" and "lat" in elem and "lon" in elem:
            pts.append((elem["lat"], elem["lon"]))
    return pts


def _extract_centers(data: dict) -> list[tuple[float, float]]:
    """Extract (lat, lng) from nodes + way/relation centers."""
    pts = []
    for elem in data.get("elements", []):
        if elem.get("type") == "node" and "lat" in elem and "lon" in elem:
            pts.append((elem["lat"], elem["lon"]))
        elif elem.get("center"):
            c = elem["center"]
            if "lat" in c and "lon" in c:
                pts.append((c["lat"], c["lon"]))
    return pts


def _extract_line_samples(
    data: dict, interval_m: float = 100.0,
) -> list[tuple[float, float]]:
    """Sample points along Overpass way geometries."""
    pts = []
    for elem in data.get("elements", []):
        if elem.get("type") != "way" or "geometry" not in elem:
            continue
        geom = elem["geometry"]
        if len(geom) < 2:
            continue
        for k in range(len(geom) - 1):
            p1, p2 = geom[k], geom[k + 1]
            seg_len = math.sqrt(
                ((p2["lat"] - p1["lat"]) * LAT_M) ** 2
                + ((p2["lon"] - p1["lon"]) * LNG_M) ** 2
            )
            n = max(1, int(seg_len / interval_m))
            for s in range(n + 1):
                t = s / max(n, 1)
                pts.append((
                    p1["lat"] + t * (p2["lat"] - p1["lat"]),
                    p1["lon"] + t * (p2["lon"] - p1["lon"]),
                ))
    return pts


def _ensure_factor_refs(key: str) -> None:
    """Load and snap reference features for a factor (idempotent)."""
    if key in _ref_nodes:
        return

    import osmnx as ox

    G = _load_graph()
    fdef = FACTOR_DEFS[key]
    data = _overpass_cached(fdef["query"])

    mode = fdef["extract"]
    if mode == "points":
        raw = _extract_points(data)
    elif mode == "centers":
        raw = _extract_centers(data)
    elif mode == "line_samples":
        raw = _extract_line_samples(data, fdef.get("sample_interval_m", 100.0))
    else:
        raise ValueError(f"Unknown extract mode: {mode}")

    if not raw:
        _ref_nodes[key] = set()
        _ref_coords[key] = {}
        return

    lats = np.array([p[0] for p in raw])
    lngs = np.array([p[1] for p in raw])

    node_ids = ox.nearest_nodes(G, lngs, lats)
    node_set: set[int] = set()
    coords: dict[int, tuple[float, float]] = {}
    for nid, (lat, lng) in zip(node_ids, raw):
        nid = int(nid)
        node_set.add(nid)
        if nid not in coords:
            coords[nid] = (lat, lng)

    _ref_nodes[key] = node_set
    _ref_coords[key] = coords
    print(f"[planner_paths] {key}: {len(raw)} features → "
          f"{len(node_set)} unique graph nodes")


# ---------------------------------------------------------------------------
# Path computation
# ---------------------------------------------------------------------------

def _compute_path(
    h3_id: str, factor_key: str,
) -> dict:
    """Run Dijkstra from hex centroid to nearest feature for the given factor.

    Returns a GeoJSON FeatureCollection with:
      - A LineString feature (the route)
      - A Point feature (the destination)
    """
    import networkx as nx
    import osmnx as ox

    G = _load_graph()
    _ensure_factor_refs(factor_key)

    fdef = FACTOR_DEFS[factor_key]
    ref_node_set = _ref_nodes[factor_key]

    if not ref_node_set:
        raise HTTPException(
            status_code=404,
            detail=f"No reference features found for factor '{factor_key}'",
        )

    # Get hex centroid
    lat, lng = h3.cell_to_latlng(h3_id)

    # Snap to nearest graph node
    hex_node = int(ox.nearest_nodes(G, [lng], [lat])[0])

    # Single-source Dijkstra from hex node
    max_dist = fdef["max_dist_m"] * 2.0  # generous cutoff
    try:
        lengths, paths = nx.single_source_dijkstra(
            G, hex_node, cutoff=max_dist, weight="length",
        )
    except nx.NodeNotFound:
        raise HTTPException(
            status_code=404,
            detail=f"Hex {h3_id} could not be snapped to the road graph",
        )

    # Find nearest reachable reference node
    best_node = None
    best_dist = float("inf")
    for rn in ref_node_set:
        if rn in lengths and lengths[rn] < best_dist:
            best_dist = lengths[rn]
            best_node = rn

    if best_node is None:
        raise HTTPException(
            status_code=404,
            detail=f"No reachable {fdef['name']} from hex {h3_id} "
                   f"within {max_dist:.0f}m",
        )

    # Extract path node sequence → coordinates
    path_nodes = paths[best_node]
    coords: list[list[float]] = []
    for nid in path_nodes:
        nd = G.nodes[nid]
        coords.append([nd["x"], nd["y"]])  # [lng, lat] for GeoJSON

    # Destination point (original feature location, not graph node)
    dest_lat, dest_lng = _ref_coords[factor_key].get(
        best_node, (G.nodes[best_node]["y"], G.nodes[best_node]["x"])
    )

    features = [
        {
            "type": "Feature",
            "properties": {
                "type": "route",
                "factor": factor_key,
                "distance_m": round(best_dist, 1),
                "nodes": len(path_nodes),
            },
            "geometry": {
                "type": "LineString",
                "coordinates": coords,
            },
        },
        {
            "type": "Feature",
            "properties": {
                "type": "destination",
                "factor": factor_key,
                "name": fdef["name"],
                "distance_m": round(best_dist, 1),
            },
            "geometry": {
                "type": "Point",
                "coordinates": [dest_lng, dest_lat],
            },
        },
        {
            "type": "Feature",
            "properties": {
                "type": "origin",
                "factor": factor_key,
                "h3": h3_id,
            },
            "geometry": {
                "type": "Point",
                "coordinates": [lng, lat],
            },
        },
    ]

    return {
        "type": "FeatureCollection",
        "properties": {
            "h3": h3_id,
            "factor": factor_key,
            "distance_m": round(best_dist, 1),
            "factor_name": fdef["name"],
        },
        "features": features,
    }


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/hex-path")
def get_hex_path(
    h3: str = Query(..., description="H3 hex ID"),
    factor: str = Query(..., description="Suitability factor key"),
):
    """Return the shortest road-network path from a hex to the nearest feature.

    This enables users to visualise *why* a hex has a certain proximity score
    by seeing the actual Dijkstra route the scoring engine used.
    """
    if factor not in FACTOR_DEFS:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown factor '{factor}'. "
                   f"Valid: {list(FACTOR_DEFS.keys())}",
        )

    try:
        return _compute_path(h3, factor)
    except HTTPException:
        raise
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
