#!/usr/bin/env python3
"""
Precompute the H3 suitability hex grid.

Generates the hex grid offline with all factor scores, raw distances,
and raw POI counts.  The result is written to ``data/hexgrid.geojson``
and rsynced to production alongside other data artefacts.  The API
server loads this file on startup (read-only).

City configuration is read from ``cities/<BIKESHARE_CITY>.yaml``
(default: edmonton).

Usage:
    python scripts/precompute-hexgrid.py                # full build
    python scripts/precompute-hexgrid.py --skip-network  # Euclidean only (fast)

Requires:
    - data/overlays/population_density.geojson  (from scripts/process-census-data.py)
    - Internet access (Overpass queries, cached permanently in data/overpass_cache/)
"""

from __future__ import annotations

import hashlib
import json
import math
import sys
import time
from pathlib import Path
from typing import Any

import h3
import numpy as np

# Allow importing from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from src.city_loader import load_city_config  # noqa: E402

_city = load_city_config()

# ---------------------------------------------------------------------------
# Paths — derived from city config
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
OVERLAYS_DIR = PROJECT_ROOT / "data" / "overlays"
OVERPASS_CACHE_DIR = PROJECT_ROOT / "data" / "overpass_cache"
CACHE_DIR = PROJECT_ROOT / "data" / "cache"
OUTPUT_FILE = PROJECT_ROOT / "data" / "hexgrid.geojson"

BBOX = _city.bbox.as_tuple
BBOX_STR = _city.bbox.overpass_str

LAT_M = _city.lat_m
LNG_M = _city.lng_m

H3_RESOLUTION = 9

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


# ═══════════════════════════════════════════════════════════════════════════
# Overpass helper (reuses the same disk cache as the backend)
# ═══════════════════════════════════════════════════════════════════════════

def overpass_query_cached(query: str, max_retries: int = 3) -> dict:
    """Fetch an Overpass query with permanent disk cache."""
    import httpx

    OVERPASS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha256(query.strip().encode()).hexdigest()[:16]
    cache_path = OVERPASS_CACHE_DIR / f"{cache_key}.json"

    if cache_path.exists():
        print(f"  [Overpass] Cache HIT  -> {cache_path.name}")
        return json.loads(cache_path.read_text())

    for attempt in range(max_retries):
        try:
            print(f"  [Overpass] Cache MISS -> fetching (attempt {attempt + 1}/{max_retries}) ...")
            resp = httpx.post(
                OVERPASS_URL,
                data={"data": query.strip()},
                headers={"User-Agent": f"{_city.app_name}/0.2"},
                timeout=180,
            )
            resp.raise_for_status()
            data = resp.json()
            cache_path.write_text(json.dumps(data))
            print(f"  [Overpass] Cached -> {cache_path.name} "
                  f"({cache_path.stat().st_size / 1024:.0f} KB)")
            return data
        except (httpx.HTTPStatusError, httpx.TimeoutException) as exc:
            if attempt < max_retries - 1:
                wait = 10 * (attempt + 1)
                print(f"  [Overpass] Attempt {attempt + 1} failed ({exc}), retrying in {wait}s ...")
                time.sleep(wait)
            else:
                raise


# ═══════════════════════════════════════════════════════════════════════════
# Overpass point / line extraction helpers
# ═══════════════════════════════════════════════════════════════════════════

def extract_points(data: dict) -> tuple[np.ndarray, np.ndarray]:
    """Extract (lats, lngs) from Overpass node results."""
    lats, lngs = [], []
    for elem in data.get("elements", []):
        if elem.get("type") == "node" and "lat" in elem and "lon" in elem:
            lats.append(elem["lat"])
            lngs.append(elem["lon"])
    return np.array(lats), np.array(lngs)


def extract_centers(data: dict) -> tuple[np.ndarray, np.ndarray]:
    """Extract (lats, lngs) from nodes + way/relation centers."""
    lats, lngs = [], []
    for elem in data.get("elements", []):
        if elem.get("type") == "node" and "lat" in elem and "lon" in elem:
            lats.append(elem["lat"])
            lngs.append(elem["lon"])
        elif elem.get("center"):
            c = elem["center"]
            if "lat" in c and "lon" in c:
                lats.append(c["lat"])
                lngs.append(c["lon"])
    return np.array(lats), np.array(lngs)


def extract_line_samples(
    data: dict, sample_interval_m: float = 100.0
) -> tuple[np.ndarray, np.ndarray]:
    """Sample points along Overpass way geometries."""
    lats, lngs = [], []
    for elem in data.get("elements", []):
        if elem.get("type") != "way" or "geometry" not in elem:
            continue
        pts = elem["geometry"]
        if len(pts) < 2:
            continue
        for k in range(len(pts) - 1):
            p1, p2 = pts[k], pts[k + 1]
            seg_len = math.sqrt(
                ((p2["lat"] - p1["lat"]) * LAT_M) ** 2
                + ((p2["lon"] - p1["lon"]) * LNG_M) ** 2
            )
            n_samples = max(1, int(seg_len / sample_interval_m))
            for s in range(n_samples + 1):
                t = s / max(n_samples, 1)
                lats.append(p1["lat"] + t * (p2["lat"] - p1["lat"]))
                lngs.append(p1["lon"] + t * (p2["lon"] - p1["lon"]))
    return np.array(lats), np.array(lngs)


# ═══════════════════════════════════════════════════════════════════════════
# Euclidean distance helpers (kept for fallback / comparison)
# ═══════════════════════════════════════════════════════════════════════════

def min_distances_m(
    query_lats: np.ndarray, query_lngs: np.ndarray,
    ref_lats: np.ndarray, ref_lngs: np.ndarray,
    batch_size: int = 2000,
) -> np.ndarray:
    """Min Euclidean distance (m) from each query point to nearest ref point."""
    if len(ref_lats) == 0:
        return np.full(len(query_lats), np.inf)
    qx, qy = query_lats * LAT_M, query_lngs * LNG_M
    rx, ry = ref_lats * LAT_M, ref_lngs * LNG_M
    min_d = np.full(len(qx), np.inf)
    for i in range(0, len(rx), batch_size):
        bx, by = rx[i : i + batch_size], ry[i : i + batch_size]
        dx = qx[:, None] - bx[None, :]
        dy = qy[:, None] - by[None, :]
        np.minimum(min_d, np.sqrt(dx * dx + dy * dy).min(axis=1), out=min_d)
    return min_d


def count_within_radius_m(
    query_lats: np.ndarray, query_lngs: np.ndarray,
    ref_lats: np.ndarray, ref_lngs: np.ndarray,
    radius_m: float, batch_size: int = 500,
) -> np.ndarray:
    """Count reference points within radius_m of each query point."""
    if len(ref_lats) == 0:
        return np.zeros(len(query_lats), dtype=np.int32)
    qx, qy = query_lats * LAT_M, query_lngs * LNG_M
    rx, ry = ref_lats * LAT_M, ref_lngs * LNG_M
    counts = np.zeros(len(qx), dtype=np.int32)
    for i in range(0, len(qx), batch_size):
        bqx, bqy = qx[i : i + batch_size], qy[i : i + batch_size]
        dx = bqx[:, None] - rx[None, :]
        dy = bqy[:, None] - ry[None, :]
        counts[i : i + batch_size] = (np.sqrt(dx * dx + dy * dy) <= radius_m).sum(axis=1)
    return counts


def decay_score(distances: np.ndarray, max_dist: float) -> np.ndarray:
    """Negative-exponential decay: 1.0 at d=0, ~0.01 at d=max_dist."""
    beta = 4.6 / max(max_dist, 1.0)
    return np.exp(-beta * distances)


def density_score(counts: np.ndarray, scale: float) -> np.ndarray:
    """Log-normalized density: score = min(1, log(1+count)/log(1+scale))."""
    if scale <= 0:
        return np.zeros_like(counts, dtype=np.float64)
    return np.clip(
        np.log1p(counts.astype(np.float64)) / np.log1p(scale), 0.0, 1.0
    )


# ═══════════════════════════════════════════════════════════════════════════
# 1. Generate H3 hex grid
# ═══════════════════════════════════════════════════════════════════════════

def generate_hex_ids() -> list[str]:
    """Generate sorted H3 hex IDs covering the city's bounding box."""
    outer = [
        (BBOX[0], BBOX[1]),
        (BBOX[0], BBOX[3]),
        (BBOX[2], BBOX[3]),
        (BBOX[2], BBOX[1]),
    ]
    poly = h3.LatLngPoly(outer)
    hex_ids = sorted(h3.polygon_to_cells(poly, H3_RESOLUTION))
    return hex_ids


def hex_centroids(hex_ids: list[str]) -> tuple[np.ndarray, np.ndarray]:
    """Return (lats, lngs) arrays for hex centroids."""
    centroids = [h3.cell_to_latlng(h) for h in hex_ids]
    lats = np.array([c[0] for c in centroids])
    lngs = np.array([c[1] for c in centroids])
    return lats, lngs


def hex_boundaries(hex_ids: list[str]) -> list[list[list[float]]]:
    """Return GeoJSON-style [lng, lat] rings for each hex."""
    rings = []
    for hid in hex_ids:
        boundary = h3.cell_to_boundary(hid)
        ring = [[round(lng, 5), round(lat, 5)] for lat, lng in boundary]
        ring.append(ring[0])
        rings.append(ring)
    return rings


# ═══════════════════════════════════════════════════════════════════════════
# 2. Road-network feasibility mask
# ═══════════════════════════════════════════════════════════════════════════

def compute_feasibility_mask(
    hex_ids: list[str],
    lats: np.ndarray,
    lngs: np.ndarray,
    buffer_m: float = 75.0,
) -> np.ndarray:
    """Return boolean array: True if hex is on/near the routable road network.

    Fetches all routable highways from Overpass, builds a Shapely STRtree
    of LineStrings, and checks each hex for proximity.
    """
    from shapely import LineString, Point, STRtree

    print("\n[Feasibility] Fetching road network from Overpass ...")
    hw_regex = (
        "^(residential|tertiary|secondary|primary|trunk|motorway"
        "|cycleway|footway|path|pedestrian|living_street|service|track"
        "|unclassified|tertiary_link|secondary_link|primary_link|trunk_link)$"
    )
    query = f"""
[out:json][timeout:180];
(
  way["highway"~"{hw_regex}"]({BBOX_STR});
);
out geom;
"""
    data = overpass_query_cached(query)
    elements = data.get("elements", [])

    # Build LineStrings from way geometries
    lines = []
    for elem in elements:
        if elem.get("type") != "way" or "geometry" not in elem:
            continue
        pts = elem["geometry"]
        if len(pts) < 2:
            continue
        coords = [(p["lon"], p["lat"]) for p in pts]
        lines.append(LineString(coords))

    print(f"  Built {len(lines):,} road/path LineStrings")

    if not lines:
        print("  WARNING: No road network found! All hexes marked non-routable.")
        return np.zeros(len(hex_ids), dtype=bool)

    tree = STRtree(lines)

    # Buffer distance in degrees (approximate)
    buf_deg = buffer_m / LNG_M

    routable = np.zeros(len(hex_ids), dtype=bool)
    for i in range(len(hex_ids)):
        pt = Point(lngs[i], lats[i])
        # Query the tree for geometries near this point
        nearby_idx = tree.query(pt.buffer(buf_deg))
        if len(nearby_idx) > 0:
            # Check actual distance to nearest line
            for j in nearby_idx:
                line = lines[j]
                # Approximate distance in metres
                dx = (pt.x - line.centroid.x) * LNG_M
                dy = (pt.y - line.centroid.y) * LAT_M
                # Use shapely distance (in degrees) * approximate m/deg
                d_deg = pt.distance(line)
                d_m = d_deg * LNG_M  # rough but fine for a boolean mask
                if d_m <= buffer_m:
                    routable[i] = True
                    break

    n_routable = int(routable.sum())
    print(f"  Routable hexes: {n_routable:,} / {len(hex_ids):,} "
          f"({n_routable / len(hex_ids) * 100:.1f}%)")
    return routable


# ═══════════════════════════════════════════════════════════════════════════
# 3. Population scoring (point-in-polygon on DA polygons)
# ═══════════════════════════════════════════════════════════════════════════

def compute_population_scores(
    lats: np.ndarray, lngs: np.ndarray,
) -> tuple[np.ndarray, np.ndarray]:
    """Assign population density to each hex via point-in-polygon on DAs.

    Returns (scores, raw_densities).
    """
    from shapely import Point, STRtree
    from shapely.geometry import shape

    pop_path = OVERLAYS_DIR / "population_density.geojson"
    if not pop_path.exists():
        print(f"  WARNING: {pop_path} not found. Run scripts/process-census-data.py first.")
        return np.zeros(len(lats)), np.zeros(len(lats))

    print("\n[Population] Loading DA polygons ...")
    with open(pop_path) as f:
        data = json.load(f)

    da_polys = []
    da_densities = []
    for feat in data["features"]:
        d = feat["properties"].get("density", 0)
        if d <= 0:
            continue
        geom = shape(feat["geometry"])
        if geom.is_empty or not geom.is_valid:
            continue
        da_polys.append(geom)
        da_densities.append(d)

    print(f"  Loaded {len(da_polys):,} DA polygons with population > 0")

    if not da_polys:
        return np.zeros(len(lats)), np.zeros(len(lats))

    # Build spatial index
    tree = STRtree(da_polys)
    da_densities_arr = np.array(da_densities)

    # Derive sigmoid reference from actual distribution
    p75 = float(np.percentile(da_densities_arr, 75))
    print(f"  Density 75th percentile: {p75:.0f} people/km² (used as sigmoid reference)")

    raw_densities = np.zeros(len(lats))

    for i in range(len(lats)):
        pt = Point(lngs[i], lats[i])
        candidates = tree.query(pt)
        for j in candidates:
            if da_polys[j].contains(pt):
                raw_densities[i] = da_densities[j]
                break

    # Sigmoid normalization using data-derived reference
    scores = 1.0 - 1.0 / (1.0 + raw_densities / max(p75, 1.0))

    n_with_pop = int((raw_densities > 0).sum())
    print(f"  Hexes with population > 0: {n_with_pop:,} / {len(lats):,}")
    print(f"  Score range: {scores.min():.3f} - {scores.max():.3f}, "
          f"mean={scores.mean():.3f}")
    return scores, raw_densities


# ═══════════════════════════════════════════════════════════════════════════
# 4. Overpass proximity/density factors
# ═══════════════════════════════════════════════════════════════════════════

# Factor definitions: (key, name, description, query, extract_mode,
#                       scoring_mode, max_dist_m, density_scale, sample_interval_m)

PROXIMITY_FACTORS = [
    {
        "key": "lrt",
        "name": f"{_city.transit.rapid_transit_label} Station Proximity",
        "description": f"Distance to nearest {_city.transit.rapid_transit_label} station (network-aware)",
        "max_dist_m": 2000.0,
        "extract": "points",
        "query": f"""
[out:json][timeout:90];
(
  node["railway"="station"]["station"="light_rail"]({BBOX_STR});
  node["railway"="station"]["station"="subway"]({BBOX_STR});
);
out body;
""",
    },
    {
        "key": "bike_infra",
        "name": "Bike Infrastructure",
        "description": "Distance to nearest protected bike path",
        "max_dist_m": 1000.0,
        "extract": "line_samples",
        "sample_interval_m": 100.0,
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
    {
        "key": "transit",
        "name": "Transit Access",
        "description": "Distance to nearest transit stop (bus + LRT)",
        "max_dist_m": 800.0,
        "extract": "points",
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
]

DENSITY_FACTORS = [
    {
        "key": "commercial",
        "name": "Commercial & Retail",
        "description": "Density of shops, restaurants, and services within range",
        "max_dist_m": 800.0,
        "density_scale": 30.0,
        "extract": "centers",
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
    {
        "key": "education",
        "name": "Education & Institutional",
        "description": "Density of schools, universities, colleges, and libraries within range",
        "max_dist_m": 1500.0,
        "density_scale": 5.0,
        "extract": "centers",
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
    {
        "key": "recreation",
        "name": "Parks & Recreation",
        "description": "Density of parks, rec centres, and sports facilities within range",
        "max_dist_m": 1000.0,
        "density_scale": 8.0,
        "extract": "centers",
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
]


def _extract_refs(factor: dict) -> tuple[np.ndarray, np.ndarray]:
    """Fetch Overpass data and extract reference points for a factor."""
    data = overpass_query_cached(factor["query"])
    mode = factor["extract"]
    if mode == "points":
        return extract_points(data)
    elif mode == "centers":
        return extract_centers(data)
    elif mode == "line_samples":
        return extract_line_samples(data, factor.get("sample_interval_m", 100.0))
    else:
        raise ValueError(f"Unknown extract mode: {mode}")


def compute_proximity_factors(
    hex_lats: np.ndarray, hex_lngs: np.ndarray,
) -> dict[str, dict[str, np.ndarray]]:
    """Compute Euclidean proximity scores + raw distances for each factor.

    Returns {key: {"score": ..., "dist": ...}}.
    """
    results: dict[str, dict[str, np.ndarray]] = {}

    for factor in PROXIMITY_FACTORS:
        key = factor["key"]
        max_dist = factor["max_dist_m"]
        t0 = time.time()
        print(f"\n[{key}] Computing proximity factor ...")

        ref_lats, ref_lngs = _extract_refs(factor)
        print(f"  Reference points: {len(ref_lats):,}")

        dists = min_distances_m(hex_lats, hex_lngs, ref_lats, ref_lngs)
        scores = decay_score(dists, max_dist)

        results[key] = {"score": scores, "dist": dists}
        print(f"  Score mean={scores.mean():.3f}, max={scores.max():.3f} "
              f"({time.time() - t0:.1f}s)")

    return results


def compute_density_factors(
    hex_lats: np.ndarray, hex_lngs: np.ndarray,
) -> dict[str, dict[str, np.ndarray]]:
    """Compute Euclidean density scores + raw counts + distances for each factor.

    Returns {key: {"score": ..., "count": ..., "dist": ...}}.
    """
    results: dict[str, dict[str, np.ndarray]] = {}

    for factor in DENSITY_FACTORS:
        key = factor["key"]
        max_dist = factor["max_dist_m"]
        scale = factor["density_scale"]
        t0 = time.time()
        print(f"\n[{key}] Computing density factor ...")

        ref_lats, ref_lngs = _extract_refs(factor)
        print(f"  Reference points: {len(ref_lats):,}")

        dists = min_distances_m(hex_lats, hex_lngs, ref_lats, ref_lngs)
        counts = count_within_radius_m(
            hex_lats, hex_lngs, ref_lats, ref_lngs, max_dist
        )
        scores = density_score(counts, scale)

        results[key] = {"score": scores, "count": counts, "dist": dists}
        print(f"  Score mean={scores.mean():.3f}, max={scores.max():.3f}, "
              f"count max={counts.max()} ({time.time() - t0:.1f}s)")

    return results


# ═══════════════════════════════════════════════════════════════════════════
# 5. Network distance scoring (Phase 2)
# ═══════════════════════════════════════════════════════════════════════════

def build_road_graph() -> Any:
    """Build or load a cached OSMnx road graph for the city.

    Returns a NetworkX MultiDiGraph suitable for shortest-path queries.
    The graph is cached to disk as a GraphML file.
    """
    import networkx as nx
    import osmnx as ox

    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_path = CACHE_DIR / f"{_city.short_code.lower()}_road_graph.graphml"

    if cache_path.exists():
        print(f"\n[Graph] Loading cached road graph from {cache_path.name} ...")
        t0 = time.time()
        G = ox.load_graphml(cache_path)
        print(f"  Loaded {G.number_of_nodes():,} nodes, "
              f"{G.number_of_edges():,} edges in {time.time() - t0:.1f}s")
        return G

    print("\n[Graph] Building road graph via OSMnx (first run, may take 2-5 min) ...")
    t0 = time.time()
    # OSMnx 2.x bbox format: (west, south, east, north)
    G = ox.graph_from_bbox(
        bbox=(BBOX[1], BBOX[0], BBOX[3], BBOX[2]),
        network_type="all",
        simplify=True,
    )
    # OSMnx 2.x adds edge lengths automatically; verify and add if missing
    sample_edge = next(iter(G.edges(data=True)))[2]
    if "length" not in sample_edge:
        G = ox.distance.add_edge_lengths(G)

    # Remove edges unsuitable for cycling: motorways, trunk roads,
    # and anything tagged >= 80 km/h.  High-speed freeways are
    # excluded regardless of local cycling legality.
    EXCLUDE_HIGHWAY = {"motorway", "motorway_link", "trunk", "trunk_link"}
    MAX_SPEED_KMH = 80
    edges_to_remove = []
    for u, v, k, data in G.edges(keys=True, data=True):
        hw = data.get("highway", "")
        if isinstance(hw, list):
            hw = hw[0]
        if hw in EXCLUDE_HIGHWAY:
            edges_to_remove.append((u, v, k))
            continue
        ms = data.get("maxspeed")
        if ms:
            if isinstance(ms, list):
                ms = ms[0]
            try:
                if int(ms) >= MAX_SPEED_KMH:
                    edges_to_remove.append((u, v, k))
            except (ValueError, TypeError):
                pass
    G.remove_edges_from(edges_to_remove)
    # Remove isolated nodes left behind
    isolated = [n for n in G.nodes() if G.degree(n) == 0]
    G.remove_nodes_from(isolated)
    print(f"  Built graph: {G.number_of_nodes():,} nodes, "
          f"{G.number_of_edges():,} edges in {time.time() - t0:.1f}s")
    print(f"  Removed {len(edges_to_remove):,} high-speed edges "
          f"(motorway/trunk/≥{MAX_SPEED_KMH} km/h), "
          f"{len(isolated):,} isolated nodes")

    ox.save_graphml(G, cache_path)
    size_mb = cache_path.stat().st_size / 1_048_576

    # Also save a minimal pickle (x/y + length only) for fast runtime loading.
    # The full GraphML is ~200 MB / 3 GB RAM; the pickle is ~26 MB / 400 MB RAM.
    import pickle
    G_min = nx.MultiDiGraph()
    G_min.graph.update(G.graph)  # preserve CRS + other OSMnx metadata
    for n, d in G.nodes(data=True):
        G_min.add_node(n, x=d["x"], y=d["y"])
    for u, v, k, d in G.edges(keys=True, data=True):
        G_min.add_edge(u, v, key=k, length=d.get("length", 0))
    pkl_path = CACHE_DIR / f"{_city.short_code.lower()}_road_graph_minimal.pkl"
    with open(pkl_path, "wb") as f:
        pickle.dump(G_min, f, protocol=pickle.HIGHEST_PROTOCOL)
    pkl_mb = pkl_path.stat().st_size / 1_048_576
    print(f"  Saved minimal pickle: {pkl_path.name} ({pkl_mb:.1f} MB)")
    print(f"  Saved to {cache_path.name} ({size_mb:.1f} MB)")
    return G


def _snap_to_graph(
    G: Any, lats: np.ndarray, lngs: np.ndarray,
) -> np.ndarray:
    """Snap (lat, lng) points to nearest graph nodes. Returns array of node IDs."""
    import osmnx as ox

    return np.array(ox.nearest_nodes(G, lngs, lats))


def compute_network_proximity(
    G: Any,
    hex_lats: np.ndarray,
    hex_lngs: np.ndarray,
    hex_node_ids: np.ndarray,
) -> dict[str, dict[str, np.ndarray]]:
    """Compute network-distance proximity for each proximity factor.

    Uses multi-source Dijkstra: flood outward from all reference points at
    once, recording the shortest path length to each graph node.  Then look
    up each hex's snapped node.

    Returns {key: {"network_dist": ..., "network_score": ...}}.
    """
    import networkx as nx

    results: dict[str, dict[str, np.ndarray]] = {}

    for factor in PROXIMITY_FACTORS:
        key = factor["key"]
        max_dist = factor["max_dist_m"]
        t0 = time.time()
        print(f"\n[{key}] Computing network proximity ...")

        ref_lats, ref_lngs = _extract_refs(factor)
        print(f"  Reference points: {len(ref_lats):,}")

        if len(ref_lats) == 0:
            results[key] = {
                "network_dist": np.full(len(hex_lats), np.inf),
                "network_score": np.zeros(len(hex_lats)),
            }
            continue

        # Snap reference points to graph
        ref_nodes = set(_snap_to_graph(G, ref_lats, ref_lngs))
        print(f"  Snapped to {len(ref_nodes):,} unique graph nodes")

        # Multi-source Dijkstra with cutoff
        # Reverse the graph so we flood OUT from sources and find
        # distance TO each reachable node
        lengths = nx.multi_source_dijkstra_path_length(
            G, sources=ref_nodes, cutoff=max_dist * 1.5, weight="length",
        )

        # Look up each hex centroid's snapped node
        network_dists = np.full(len(hex_lats), np.inf)
        for i, node_id in enumerate(hex_node_ids):
            if node_id in lengths:
                network_dists[i] = lengths[node_id]

        network_scores = decay_score(network_dists, max_dist)

        results[key] = {
            "network_dist": network_dists,
            "network_score": network_scores,
        }
        print(f"  Network score mean={network_scores.mean():.3f}, "
              f"max={network_scores.max():.3f} ({time.time() - t0:.1f}s)")
        n_reachable = int((network_dists < np.inf).sum())
        print(f"  Reachable hexes: {n_reachable:,} / {len(hex_lats):,}")

    return results


def compute_network_density(
    G: Any,
    hex_lats: np.ndarray,
    hex_lngs: np.ndarray,
    hex_node_ids: np.ndarray,
) -> dict[str, dict[str, np.ndarray]]:
    """Compute network-distance density for each density factor.

    For each hex centroid, run a single-source Dijkstra with cutoff and
    count how many POI nodes are reachable within the radius.

    Returns {key: {"network_count": ..., "network_score": ...}}.
    """
    import networkx as nx

    results: dict[str, dict[str, np.ndarray]] = {}

    for factor in DENSITY_FACTORS:
        key = factor["key"]
        max_dist = factor["max_dist_m"]
        scale = factor["density_scale"]
        t0 = time.time()
        print(f"\n[{key}] Computing network density ...")

        ref_lats, ref_lngs = _extract_refs(factor)
        print(f"  Reference points: {len(ref_lats):,}")

        if len(ref_lats) == 0:
            results[key] = {
                "network_count": np.zeros(len(hex_lats), dtype=np.int32),
                "network_score": np.zeros(len(hex_lats)),
            }
            continue

        ref_nodes = _snap_to_graph(G, ref_lats, ref_lngs)
        # Build a set with counts (multiple POIs can snap to same node)
        from collections import Counter
        ref_node_counts = Counter(ref_nodes.tolist())
        ref_node_set = set(ref_node_counts.keys())
        print(f"  Snapped to {len(ref_node_set):,} unique graph nodes")

        network_counts = np.zeros(len(hex_lats), dtype=np.int32)
        unique_hex_nodes = {}
        for i, node_id in enumerate(hex_node_ids):
            nid = int(node_id)
            if nid not in unique_hex_nodes:
                unique_hex_nodes[nid] = []
            unique_hex_nodes[nid].append(i)

        processed = 0
        for nid, hex_indices in unique_hex_nodes.items():
            try:
                reachable = nx.single_source_dijkstra_path_length(
                    G, nid, cutoff=max_dist, weight="length",
                )
            except nx.NodeNotFound:
                continue

            count = sum(
                ref_node_counts[r_node]
                for r_node in reachable
                if r_node in ref_node_set
            )
            for idx in hex_indices:
                network_counts[idx] = count

            processed += 1
            if processed % 500 == 0:
                print(f"  ... processed {processed:,} / {len(unique_hex_nodes):,} "
                      f"unique hex nodes")

        network_scores = density_score(network_counts, scale)

        results[key] = {
            "network_count": network_counts,
            "network_score": network_scores,
        }
        print(f"  Network score mean={network_scores.mean():.3f}, "
              f"max={network_scores.max():.3f}, "
              f"count max={network_counts.max()} ({time.time() - t0:.1f}s)")

    return results


# ═══════════════════════════════════════════════════════════════════════════
# 6. Assemble hex grid GeoJSON
# ═══════════════════════════════════════════════════════════════════════════

def build_hexgrid(
    hex_ids: list[str],
    rings: list[list[list[float]]],
    routable: np.ndarray,
    pop_scores: np.ndarray,
    pop_densities: np.ndarray,
    prox_results: dict[str, dict[str, np.ndarray]],
    dens_results: dict[str, dict[str, np.ndarray]],
    net_prox_results: dict[str, dict[str, np.ndarray]] | None = None,
    net_dens_results: dict[str, dict[str, np.ndarray]] | None = None,
    metadata: dict[str, Any] | None = None,
) -> dict:
    """Assemble the final GeoJSON FeatureCollection."""
    features: list[dict[str, Any]] = []

    for i, hid in enumerate(hex_ids):
        is_routable = bool(routable[i])

        props: dict[str, Any] = {
            "h3": hid,
            "routable": is_routable,
        }

        if is_routable:
            # Population
            props["population"] = round(float(pop_scores[i]), 4)
            props["population_density"] = round(float(pop_densities[i]), 1)

            # Proximity factors (Euclidean)
            for key, data in prox_results.items():
                props[key] = round(float(data["score"][i]), 4)
                d = float(data["dist"][i])
                props[f"{key}_dist"] = round(d, 1) if np.isfinite(d) else None

            # Network proximity (overrides Euclidean score if available)
            if net_prox_results:
                for key, data in net_prox_results.items():
                    nd = float(data["network_dist"][i])
                    props[f"{key}_network_dist"] = round(nd, 1) if np.isfinite(nd) else None
                    props[key] = round(float(data["network_score"][i]), 4)

            # Density factors (Euclidean)
            for key, data in dens_results.items():
                props[key] = round(float(data["score"][i]), 4)
                d = float(data["dist"][i])
                props[f"{key}_dist"] = round(d, 1) if np.isfinite(d) else None
                props[f"{key}_count"] = int(data["count"][i])

            # Network density (overrides Euclidean score if available)
            if net_dens_results:
                for key, data in net_dens_results.items():
                    props[f"{key}_network_count"] = int(data["network_count"][i])
                    props[key] = round(float(data["network_score"][i]), 4)
        else:
            # Non-routable: zero everything (use null for distances, not Infinity)
            props["population"] = 0.0
            props["population_density"] = 0.0
            for key in prox_results:
                props[key] = 0.0
                props[f"{key}_dist"] = None
                if net_prox_results and key in net_prox_results:
                    props[f"{key}_network_dist"] = None
            for key in dens_results:
                props[key] = 0.0
                props[f"{key}_dist"] = None
                props[f"{key}_count"] = 0
                if net_dens_results and key in net_dens_results:
                    props[f"{key}_network_count"] = 0

        features.append({
            "type": "Feature",
            "geometry": {"type": "Polygon", "coordinates": [rings[i]]},
            "properties": props,
        })

    result: dict[str, Any] = {
        "type": "FeatureCollection",
        "features": features,
    }

    if metadata:
        result["metadata"] = metadata

    return result


# ═══════════════════════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════════════════════

def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description=f"Precompute {_city.app_name} hex grid")
    parser.add_argument(
        "--skip-network", action="store_true",
        help="Skip network-distance computation (Euclidean only, faster)",
    )
    args = parser.parse_args()

    t_start = time.time()
    print("=" * 60)
    print(f"{_city.app_name} — Hex Grid Precomputation")
    print("=" * 60)

    # 1. Generate hex grid
    print(f"\n[Grid] Generating H3 hexes at resolution {H3_RESOLUTION} ...")
    hex_ids = generate_hex_ids()
    lats, lngs = hex_centroids(hex_ids)
    rings = hex_boundaries(hex_ids)
    print(f"  Generated {len(hex_ids):,} hexes")

    # 2. Feasibility mask
    routable = compute_feasibility_mask(hex_ids, lats, lngs)

    # 3. Population (point-in-polygon)
    pop_scores, pop_densities = compute_population_scores(lats, lngs)
    pop_scores[~routable] = 0.0
    pop_densities[~routable] = 0.0

    # 4. Proximity factors (Euclidean baseline)
    prox_results = compute_proximity_factors(lats, lngs)
    for key in prox_results:
        prox_results[key]["score"][~routable] = 0.0

    # 5. Density factors (Euclidean baseline)
    dens_results = compute_density_factors(lats, lngs)
    for key in dens_results:
        dens_results[key]["score"][~routable] = 0.0

    # 6. Network distance scoring (unless --skip-network)
    net_prox_results = None
    net_dens_results = None
    scoring_method = "euclidean"

    if not args.skip_network:
        try:
            G = build_road_graph()
            hex_node_ids = _snap_to_graph(G, lats, lngs)
            print(f"\n[Network] Snapped {len(hex_node_ids):,} hex centroids to graph nodes")

            net_prox_results = compute_network_proximity(
                G, lats, lngs, hex_node_ids,
            )
            for key in net_prox_results:
                net_prox_results[key]["network_score"][~routable] = 0.0

            net_dens_results = compute_network_density(
                G, lats, lngs, hex_node_ids,
            )
            for key in net_dens_results:
                net_dens_results[key]["network_score"][~routable] = 0.0

            scoring_method = "network"
        except Exception as exc:
            print(f"\n[Network] WARNING: Network scoring failed ({exc})")
            print("[Network] Falling back to Euclidean-only scoring")
            import traceback
            traceback.print_exc()
    else:
        print("\n[Network] Skipped (--skip-network)")

    # 7. Metadata
    factor_info = []
    for f in PROXIMITY_FACTORS:
        factor_info.append({
            "key": f["key"], "name": f["name"], "description": f["description"],
            "scoring": "proximity", "max_dist_m": f["max_dist_m"],
        })
    factor_info.append({
        "key": "population", "name": "Population Density",
        "description": "2021 Census population density by Dissemination Area",
        "scoring": "sigmoid",
    })
    for f in DENSITY_FACTORS:
        factor_info.append({
            "key": f["key"], "name": f["name"], "description": f["description"],
            "scoring": "density", "max_dist_m": f["max_dist_m"],
            "density_scale": f["density_scale"],
        })

    metadata = {
        "h3_resolution": H3_RESOLUTION,
        "bbox": list(BBOX),
        "total_hexes": len(hex_ids),
        "routable_hexes": int(routable.sum()),
        "scoring_method": scoring_method,
        "decay_function": "negative_exponential",
        "factors": factor_info,
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    }

    # 8. Build and write GeoJSON
    print("\n[Output] Building GeoJSON ...")
    geojson = build_hexgrid(
        hex_ids, rings, routable,
        pop_scores, pop_densities,
        prox_results, dens_results,
        net_prox_results=net_prox_results,
        net_dens_results=net_dens_results,
        metadata=metadata,
    )

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_mb = OUTPUT_FILE.stat().st_size / 1_048_576
    elapsed = time.time() - t_start

    print(f"\n{'=' * 60}")
    print(f"Done in {elapsed:.1f}s")
    print(f"  Output: {OUTPUT_FILE}")
    print(f"  Size:   {size_mb:.1f} MB")
    print(f"  Hexes:  {len(hex_ids):,} total, {int(routable.sum()):,} routable")
    print(f"{'=' * 60}")


if __name__ == "__main__":
    main()
