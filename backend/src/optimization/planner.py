"""
Automated bike-share network planner.

Architecture (designed for easy extension):
  1. SuitabilityFactor – pluggable scoring layers (population, LRT, bike infra, …)
  2. SuitabilityEngine  – generates H3 hex grid, computes all factor scores
  3. NetworkOptimizer   – MCLP solver (OR-Tools) picks optimal station locations
  4. CapacitySizer      – heuristic dock-count assignment

To add a new factor: subclass SuitabilityFactor, implement precompute() and
score_batch(), then register it in SuitabilityEngine.FACTORS.
"""

from __future__ import annotations

import json
import math
import time
import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import h3
import numpy as np
from ortools.sat.python import cp_model

from src.config import settings, city

# ---------------------------------------------------------------------------
# Shared default constants — kept in one place so API schemas and
# OptimizeConfig can reference the same values.
# ---------------------------------------------------------------------------

#: Decay radii (metres) for proximity-scored suitability factors.
DEFAULT_DECAY_RADII: dict[str, float] = {
    "lrt": 2000.0,
    "bike_infra": 1000.0,
    "transit": 800.0,
}

#: Saturation scale for density-scored POI factors (count at score ≈ 1.0).
DEFAULT_DENSITY_SCALES: dict[str, float] = {
    "commercial": 30.0,
    "education": 5.0,
    "recreation": 8.0,
}

#: Default factor weights (0-1).
DEFAULT_WEIGHTS: dict[str, float] = {
    "population": 0.8,
    "lrt": 0.5,
    "bike_infra": 0.5,
    "transit": 0.4,
    "commercial": 0.6,
    "education": 0.4,
    "recreation": 0.3,
    "hilliness": 0.3,
}

# ---------------------------------------------------------------------------
# Constants — derived from city config
# ---------------------------------------------------------------------------

_LAT_M = city.lat_m
_LNG_M = city.lng_m

_PROJECT_ROOT = Path(__file__).resolve().parents[3]
_OVERLAYS_DIR = _PROJECT_ROOT / "data" / "overlays"
_OVERPASS_CACHE_DIR = _PROJECT_ROOT / "data" / "overpass_cache"

_BBOX = city.bbox.as_tuple

OVERPASS_URL = "https://overpass-api.de/api/interpreter"


def _overpass_query_cached(query: str, max_retries: int = 3) -> dict:
    """Fetch an Overpass query, using a permanent disk cache.

    The geographic data (LRT stations, bike lanes, bus stops) barely changes,
    so we cache the raw JSON response forever.  Delete the file from
    data/overpass_cache/ if you need to force a refresh.
    """
    import hashlib
    import httpx

    _OVERPASS_CACHE_DIR.mkdir(parents=True, exist_ok=True)
    cache_key = hashlib.sha256(query.strip().encode()).hexdigest()[:16]
    cache_path = _OVERPASS_CACHE_DIR / f"{cache_key}.json"

    if cache_path.exists():
        print(f"[Overpass] Cache HIT  → {cache_path.name}")
        return json.loads(cache_path.read_text())

    # Not cached — fetch from API with retries
    for attempt in range(max_retries):
        try:
            print(f"[Overpass] Cache MISS → fetching from API (attempt {attempt + 1}/{max_retries}) …")
            resp = httpx.post(
                OVERPASS_URL,
                data={"data": query.strip()},
                headers={"User-Agent": f"{city.app_name}/0.2"},
                timeout=180,
            )
            resp.raise_for_status()
            data = resp.json()

            # Persist to disk
            cache_path.write_text(json.dumps(data))
            print(f"[Overpass] Cached → {cache_path.name} ({cache_path.stat().st_size / 1024:.0f} KB)")
            return data
        except (httpx.HTTPStatusError, httpx.TimeoutException) as exc:
            if attempt < max_retries - 1:
                wait = 10 * (attempt + 1)  # 10s, 20s backoff
                print(f"[Overpass] Attempt {attempt + 1} failed ({exc}), retrying in {wait}s …")
                time.sleep(wait)
            else:
                raise  # propagate on final failure


# ---------------------------------------------------------------------------
# Suitability factor base class
# ---------------------------------------------------------------------------

class SuitabilityFactor(ABC):
    """Base class for a spatial scoring layer.

    Each factor:
      - Has a human-readable ``name`` and ``key`` (for JSON serialisation)
      - Can ``precompute`` spatial indices from public data
      - Can ``score_batch`` an array of (lat, lng) centroids → 0-1 scores
    """

    name: str
    key: str
    description: str

    _ready: bool = False

    @abstractmethod
    def precompute(self) -> None:
        """Load / fetch data and build spatial index. Idempotent."""

    @abstractmethod
    def score_batch(self, lats: np.ndarray, lngs: np.ndarray) -> np.ndarray:
        """Return array of 0-1 scores for each centroid."""

    def _ensure_ready(self) -> None:
        if not self._ready:
            self.precompute()
            self._ready = True


# ---------------------------------------------------------------------------
# Proximity helper
# ---------------------------------------------------------------------------

def _min_distances_m(
    query_lats: np.ndarray,
    query_lngs: np.ndarray,
    ref_lats: np.ndarray,
    ref_lngs: np.ndarray,
    batch_size: int = 2000,
) -> np.ndarray:
    """Compute minimum Euclidean distance (metres) from each query point
    to the nearest reference point.  Uses batched numpy for memory efficiency.
    """
    if len(ref_lats) == 0:
        return np.full(len(query_lats), np.inf)

    qx = query_lats * _LAT_M
    qy = query_lngs * _LNG_M
    rx = ref_lats * _LAT_M
    ry = ref_lngs * _LNG_M

    min_d = np.full(len(qx), np.inf)
    for i in range(0, len(rx), batch_size):
        bx = rx[i : i + batch_size]
        by = ry[i : i + batch_size]
        dx = qx[:, None] - bx[None, :]   # (N, B)
        dy = qy[:, None] - by[None, :]
        dists = np.sqrt(dx * dx + dy * dy)
        np.minimum(min_d, dists.min(axis=1), out=min_d)
    return min_d


def _count_within_radius_m(
    query_lats: np.ndarray,
    query_lngs: np.ndarray,
    ref_lats: np.ndarray,
    ref_lngs: np.ndarray,
    radius_m: float,
    batch_size: int = 500,
) -> np.ndarray:
    """For each query point, count how many reference points are within radius_m.

    Uses chunked queries to keep memory bounded when there are many ref points
    (e.g. 10k+ commercial POIs).
    """
    if len(ref_lats) == 0:
        return np.zeros(len(query_lats), dtype=np.int32)

    qx = query_lats * _LAT_M
    qy = query_lngs * _LNG_M
    rx = ref_lats * _LAT_M
    ry = ref_lngs * _LNG_M

    counts = np.zeros(len(qx), dtype=np.int32)
    for i in range(0, len(qx), batch_size):
        bqx = qx[i : i + batch_size]
        bqy = qy[i : i + batch_size]
        dx = bqx[:, None] - rx[None, :]   # (chunk, N_ref)
        dy = bqy[:, None] - ry[None, :]
        dists = np.sqrt(dx * dx + dy * dy)
        counts[i : i + batch_size] = (dists <= radius_m).sum(axis=1)
    return counts


def _decay(distances: np.ndarray, max_dist: float) -> np.ndarray:
    """Linear decay: 1 at distance 0, 0 at max_dist."""
    return np.clip(1.0 - distances / max_dist, 0.0, 1.0)


# ---------------------------------------------------------------------------
# Concrete factors
# ---------------------------------------------------------------------------

class PopulationFactor(SuitabilityFactor):
    """Population density from pre-processed DA GeoJSON."""

    name = "Population Density"
    key = "population"
    description = "2021 Census population density by Dissemination Area"

    _centroids_lat: np.ndarray
    _centroids_lng: np.ndarray
    _densities: np.ndarray

    def precompute(self) -> None:
        path = _OVERLAYS_DIR / "population_density.geojson"
        if not path.exists():
            raise FileNotFoundError(f"Run scripts/process-census-data.py first: {path}")
        with open(path) as f:
            data = json.load(f)

        lats, lngs, densities = [], [], []
        for feat in data["features"]:
            props = feat["properties"]
            d = props.get("density", 0)
            if d <= 0:
                continue
            # Compute centroid from geometry
            geom = feat["geometry"]
            coords = _flatten_coords(geom)
            if not coords:
                continue
            clat = sum(c[1] for c in coords) / len(coords)
            clng = sum(c[0] for c in coords) / len(coords)
            lats.append(clat)
            lngs.append(clng)
            densities.append(d)

        self._centroids_lat = np.array(lats)
        self._centroids_lng = np.array(lngs)
        self._densities = np.array(densities)
        self._ready = True

    def score_batch(self, lats: np.ndarray, lngs: np.ndarray) -> np.ndarray:
        self._ensure_ready()
        # Find index of nearest DA for each hex
        qx = lats * _LAT_M
        qy = lngs * _LNG_M
        rx = self._centroids_lat * _LAT_M
        ry = self._centroids_lng * _LNG_M

        # Brute-force nearest neighbour (N_hex × N_da is manageable)
        nearest_idx = np.zeros(len(lats), dtype=int)
        BATCH = 500
        for i in range(0, len(qx), BATCH):
            bqx = qx[i : i + BATCH]
            bqy = qy[i : i + BATCH]
            dx = bqx[:, None] - rx[None, :]
            dy = bqy[:, None] - ry[None, :]
            d2 = dx * dx + dy * dy
            nearest_idx[i : i + BATCH] = d2.argmin(axis=1)

        densities = self._densities[nearest_idx]
        # Normalize with a sigmoid-like curve so high-density areas stand out
        # Reference: 5000 people/km² ≈ score 0.75
        return 1.0 - 1.0 / (1.0 + densities / 3000.0)


class _OverpassProximityFactor(SuitabilityFactor):
    """Base for factors computed from Overpass point/line data."""

    _query: str = ""
    _max_dist_m: float = 2000.0
    _extract: str = "points"  # "points", "line_samples", or "centers"
    _sample_interval_m: float = 100.0

    _ref_lats: np.ndarray
    _ref_lngs: np.ndarray

    def precompute(self) -> None:
        data = _overpass_query_cached(self._query)

        lats: list[float] = []
        lngs: list[float] = []

        for elem in data.get("elements", []):
            if self._extract == "points":
                if elem.get("type") == "node" and "lat" in elem and "lon" in elem:
                    lats.append(elem["lat"])
                    lngs.append(elem["lon"])
            elif self._extract == "centers":
                # Nodes have lat/lon directly; ways/relations get a "center"
                # field when queried with `out center;`
                if elem.get("type") == "node" and "lat" in elem and "lon" in elem:
                    lats.append(elem["lat"])
                    lngs.append(elem["lon"])
                elif elem.get("center"):
                    c = elem["center"]
                    if "lat" in c and "lon" in c:
                        lats.append(c["lat"])
                        lngs.append(c["lon"])
            elif self._extract == "line_samples":
                if elem.get("type") == "way" and "geometry" in elem:
                    pts = elem["geometry"]
                    if len(pts) < 2:
                        continue
                    # Sample points along the line
                    for k in range(len(pts) - 1):
                        p1 = pts[k]
                        p2 = pts[k + 1]
                        seg_len = math.sqrt(
                            ((p2["lat"] - p1["lat"]) * _LAT_M) ** 2
                            + ((p2["lon"] - p1["lon"]) * _LNG_M) ** 2
                        )
                        n_samples = max(1, int(seg_len / self._sample_interval_m))
                        for s in range(n_samples + 1):
                            t = s / max(n_samples, 1)
                            lats.append(p1["lat"] + t * (p2["lat"] - p1["lat"]))
                            lngs.append(p1["lon"] + t * (p2["lon"] - p1["lon"]))

        self._ref_lats = np.array(lats)
        self._ref_lngs = np.array(lngs)
        self._ready = True

    # Scoring mode: "proximity" = distance-to-nearest decay (default),
    #               "density"   = count-within-radius log normalization
    _scoring: str = "proximity"
    # Default density scale (POIs at which score = 1.0).
    # Only used when _scoring == "density".  Overridden per-factor.
    _density_scale: float = 20.0

    _last_distances: np.ndarray | None = None
    _last_counts: np.ndarray | None = None

    def score_batch(
        self,
        lats: np.ndarray,
        lngs: np.ndarray,
        density_scale: float | None = None,
    ) -> np.ndarray:
        self._ensure_ready()
        dists = _min_distances_m(lats, lngs, self._ref_lats, self._ref_lngs)
        self._last_distances = dists  # cache for hex grid export

        if self._scoring == "density":
            counts = _count_within_radius_m(
                lats, lngs, self._ref_lats, self._ref_lngs, self._max_dist_m,
            )
            self._last_counts = counts
            scale = density_scale if density_scale is not None else self._density_scale
            # Log normalization: smooth curve, handles large variance in counts
            return np.clip(
                np.log1p(counts.astype(np.float64)) / np.log1p(scale),
                0.0, 1.0,
            )

        return _decay(dists, self._max_dist_m)


def _bbox_str() -> str:
    """Current city bounding box as an Overpass-compatible string."""
    return city.bbox.overpass_str


class RapidTransitProximityFactor(_OverpassProximityFactor):
    key = "lrt"
    description = "Distance to nearest rapid transit station"
    _max_dist_m = 2000.0
    _extract = "points"

    @property
    def name(self) -> str:
        return f"{city.transit.rapid_transit_label} Station Proximity"

    @property
    def _query(self) -> str:
        b = _bbox_str()
        return f"""
[out:json][timeout:90];
(
  node["railway"="station"]["station"="light_rail"]({b});
  node["railway"="station"]["station"="subway"]({b});
);
out body;
"""


class BikeInfraFactor(_OverpassProximityFactor):
    name = "Bike Infrastructure"
    key = "bike_infra"
    description = "Distance to nearest protected bike path"
    _max_dist_m = 1000.0
    _extract = "line_samples"
    _sample_interval_m = 100.0

    @property
    def _query(self) -> str:
        b = _bbox_str()
        return f"""
[out:json][timeout:60];
(
  way["highway"="cycleway"]({b});
  way["highway"="path"]["bicycle"="designated"]({b});
  way["cycleway"="track"]["highway"]({b});
);
out geom;
"""


class TransitAccessFactor(_OverpassProximityFactor):
    name = "Transit Access"
    key = "transit"
    description = "Distance to nearest transit stop (bus + rapid transit)"
    _max_dist_m = 800.0
    _extract = "points"

    @property
    def _query(self) -> str:
        b = _bbox_str()
        return f"""
[out:json][timeout:60];
(
  node["highway"="bus_stop"]({b});
  node["public_transport"="stop_position"]["bus"="yes"]({b});
  node["railway"="station"]["station"="light_rail"]({b});
);
out body;
"""


class CommercialFactor(_OverpassProximityFactor):
    """Density of shops, restaurants, cafes, and services."""

    name = "Commercial & Retail"
    key = "commercial"
    description = "Density of shops, restaurants, and services within range"
    _max_dist_m = 800.0
    _extract = "centers"
    _scoring = "density"
    _density_scale = 30.0

    @property
    def _query(self) -> str:
        b = _bbox_str()
        return f"""
[out:json][timeout:120];
(
  node["shop"]({b});
  way["shop"]({b});
  node["amenity"~"^(restaurant|cafe|fast_food|bar|bank|pharmacy|marketplace|clinic|dentist)$"]({b});
  way["amenity"~"^(restaurant|cafe|fast_food|bar|bank|pharmacy|marketplace|clinic|dentist)$"]({b});
);
out center;
"""


class EducationFactor(_OverpassProximityFactor):
    """Density of schools, universities, colleges, and libraries."""

    name = "Education & Institutional"
    key = "education"
    description = "Density of schools, universities, colleges, and libraries within range"
    _max_dist_m = 1500.0
    _extract = "centers"
    _scoring = "density"
    _density_scale = 5.0

    @property
    def _query(self) -> str:
        b = _bbox_str()
        return f"""
[out:json][timeout:60];
(
  node["amenity"~"^(university|college|school|library)$"]({b});
  way["amenity"~"^(university|college|school|library)$"]({b});
  relation["amenity"~"^(university|college|school|library)$"]({b});
);
out center;
"""


class RecreationFactor(_OverpassProximityFactor):
    """Density of parks, recreation centres, sports facilities, and pools."""

    name = "Parks & Recreation"
    key = "recreation"
    description = "Density of parks, rec centres, and sports facilities within range"
    _max_dist_m = 1000.0
    _extract = "centers"
    _scoring = "density"
    _density_scale = 8.0

    @property
    def _query(self) -> str:
        b = _bbox_str()
        return f"""
[out:json][timeout:90];
(
  node["leisure"~"^(park|sports_centre|fitness_centre|swimming_pool|playground)$"]({b});
  way["leisure"~"^(park|sports_centre|fitness_centre|swimming_pool|playground)$"]({b});
  relation["leisure"="park"]({b});
  node["amenity"="community_centre"]({b});
  way["amenity"="community_centre"]({b});
);
out center;
"""


# ---------------------------------------------------------------------------
# Geometry helper
# ---------------------------------------------------------------------------

def _flatten_coords(geom: dict) -> list[list[float]]:
    """Extract flat list of [lng, lat] from a GeoJSON geometry."""
    gtype = geom.get("type", "")
    coords = geom.get("coordinates", [])
    if gtype == "Polygon":
        return coords[0] if coords else []
    elif gtype == "MultiPolygon":
        return coords[0][0] if coords and coords[0] else []
    elif gtype == "Point":
        return [coords] if coords else []
    return []


# ---------------------------------------------------------------------------
# Suitability engine
# ---------------------------------------------------------------------------

class SuitabilityEngine:
    """Loads and serves the precomputed H3 hex grid with factor scores.

    The hex grid is built offline by ``scripts/precompute-hexgrid.py`` and
    deployed as ``data/hexgrid.geojson``.  This class loads that file on
    first request and caches it in memory.

    If the precomputed file is missing, falls back to legacy on-the-fly
    computation with a deprecation warning.
    """

    @staticmethod
    def _build_factor_meta() -> list[dict[str, str]]:
        label = city.transit.rapid_transit_label
        return [
            {"key": "population", "name": "Population Density",
             "description": "Census population density (point-in-polygon)"},
            {"key": "hilliness", "name": "Terrain Flatness",
             "description": "Average slope to H3 neighbours — flat terrain scores highest"},
            {"key": "lrt", "name": f"{label} Station Proximity",
             "description": f"Distance to nearest {label} station"},
            {"key": "bike_infra", "name": "Bike Infrastructure",
             "description": "Distance to nearest protected bike path"},
            {"key": "transit", "name": "Transit Access",
             "description": f"Distance to nearest transit stop (bus + {label})"},
            {"key": "commercial", "name": "Commercial & Retail",
             "description": "Density of shops, restaurants, and services within range"},
            {"key": "education", "name": "Education & Institutional",
             "description": "Density of schools, universities, colleges, and libraries within range"},
            {"key": "recreation", "name": "Parks & Recreation",
             "description": "Density of parks, rec centres, and sports facilities within range"},
        ]

    FACTOR_CLASSES: list[type[SuitabilityFactor]] = [
        PopulationFactor,
        RapidTransitProximityFactor,
        BikeInfraFactor,
        TransitAccessFactor,
        CommercialFactor,
        EducationFactor,
        RecreationFactor,
    ]

    _HEXGRID_PATH = _PROJECT_ROOT / "data" / "hexgrid.geojson"

    def __init__(self, resolution: int | None = None):
        self.resolution = resolution or settings.h3_resolution
        self._hex_data: dict | None = None

    @property
    def factors(self) -> list[dict[str, str]]:
        """Factor metadata for the /planner/factors endpoint."""
        return self._build_factor_meta()

    def compute_hex_grid(self) -> dict:
        """Return GeoJSON FeatureCollection with per-hex factor scores.

        Loads from ``data/hexgrid.geojson`` (precomputed offline).
        Falls back to legacy on-the-fly computation if the file is missing.
        """
        if self._hex_data is not None:
            return self._hex_data

        if self._HEXGRID_PATH.exists():
            t0 = time.time()
            print(f"[Planner] Loading precomputed hex grid from {self._HEXGRID_PATH.name} ...")
            with open(self._HEXGRID_PATH) as f:
                data = json.load(f)
            n = len(data.get("features", []))
            meta = data.get("metadata", {})
            routable = sum(
                1 for feat in data["features"]
                if feat["properties"].get("routable", True)
            )
            print(f"[Planner] Loaded {n:,} hexes ({routable:,} routable) in "
                  f"{time.time() - t0:.1f}s")
            if meta:
                print(f"[Planner] Generated: {meta.get('generated_at', '?')}, "
                      f"scoring: {meta.get('scoring_method', '?')}, "
                      f"decay: {meta.get('decay_function', '?')}")
            self._hex_data = data
            return data

        # Legacy fallback — compute on the fly (deprecated)
        print("[Planner] WARNING: data/hexgrid.geojson not found!")
        print("[Planner]   Run: python scripts/precompute-hexgrid.py")
        print("[Planner]   Falling back to legacy on-the-fly computation ...")
        return self._legacy_compute()

    def _legacy_compute(self) -> dict:
        """Legacy on-the-fly hex grid computation (deprecated fallback)."""
        t0 = time.time()
        factors = [cls() for cls in self.FACTOR_CLASSES]

        outer = [
            (_BBOX[0], _BBOX[1]),
            (_BBOX[0], _BBOX[3]),
            (_BBOX[2], _BBOX[3]),
            (_BBOX[2], _BBOX[1]),
        ]
        poly = h3.LatLngPoly(outer)
        hex_ids = sorted(h3.polygon_to_cells(poly, self.resolution))
        n = len(hex_ids)
        print(f"[Planner/Legacy] Generated {n:,} H3 hexes at resolution {self.resolution}")

        centroids = [h3.cell_to_latlng(h) for h in hex_ids]
        lats = np.array([c[0] for c in centroids])
        lngs = np.array([c[1] for c in centroids])

        factor_scores: dict[str, np.ndarray] = {}
        factor_distances: dict[str, np.ndarray] = {}
        factor_counts: dict[str, np.ndarray] = {}
        any_failed = False
        for factor in factors:
            ft = time.time()
            try:
                factor._ensure_ready()
                scores = factor.score_batch(lats, lngs)
                factor_scores[factor.key] = scores
                if isinstance(factor, _OverpassProximityFactor):
                    if factor._last_distances is not None:
                        factor_distances[factor.key] = factor._last_distances
                    if factor._last_counts is not None:
                        factor_counts[factor.key] = factor._last_counts
                print(f"[Planner/Legacy]   {factor.name}: {time.time()-ft:.1f}s "
                      f"(mean={scores.mean():.3f}, max={scores.max():.3f})")
            except Exception as exc:
                print(f"[Planner/Legacy]   {factor.name}: FAILED ({exc})")
                factor_scores[factor.key] = np.zeros(n)
                any_failed = True

        features: list[dict[str, Any]] = []
        for i, hid in enumerate(hex_ids):
            boundary = h3.cell_to_boundary(hid)
            ring = [[round(lng, 5), round(lat, 5)] for lat, lng in boundary]
            ring.append(ring[0])

            props: dict[str, Any] = {"h3": hid, "routable": True}
            for key, scores in factor_scores.items():
                props[key] = round(float(scores[i]), 4)
            for key, dists in factor_distances.items():
                props[f"{key}_dist"] = round(float(dists[i]), 1)
            for key, counts in factor_counts.items():
                props[f"{key}_count"] = int(counts[i])

            features.append({
                "type": "Feature",
                "geometry": {"type": "Polygon", "coordinates": [ring]},
                "properties": props,
            })

        result = {"type": "FeatureCollection", "features": features}
        print(f"[Planner/Legacy] Hex grid computed in {time.time()-t0:.1f}s")
        if not any_failed:
            self._hex_data = result
        return result


# ---------------------------------------------------------------------------
# Network optimizer (MCLP via OR-Tools CP-SAT)
# ---------------------------------------------------------------------------

@dataclass
class OptimizeConfig:
    """User-configurable parameters for the network optimizer."""
    # Algorithm selection
    algorithm: str = "iterative_mclp"  # "iterative_mclp" | "greedy"
    batch_size: int = 5  # stations per MCLP batch (only for iterative_mclp)
    # Core parameters
    num_stations: int = 40
    coverage_radius_m: float = 1000.0
    min_spacing_m: float = 800.0
    max_solve_seconds: float = 15.0
    # Fleet sizing
    total_bikes: int = 600
    min_docks_per_station: int = 15
    max_docks_per_station: int = 30
    target_fill_pct: float = 0.5  # initial bike fill ratio (0-1)
    # Station proximity discount — penalises being too close
    proximity_discount_radius: float = 500.0  # metres
    proximity_discount_strength: float = 0.7  # 0-1 (0 = no discount, 1 = full)
    # Network connectivity — penalises being too far from any existing station
    connectivity_radius: float = 2000.0  # metres — beyond this, penalty kicks in
    connectivity_strength: float = 0.6   # 0-1 (0 = no penalty, 1 = full)
    # Per-factor decay radii (metres) — controls how far each proximity factor's
    # influence extends.  Not used for density-scored factors (commercial, etc.).
    decay_radii: dict[str, float] = field(default_factory=lambda: dict(DEFAULT_DECAY_RADII))
    # Density scales — for density-scored POI factors, the POI count at which
    # the score reaches 1.0 (log normalization).
    density_scales: dict[str, float] = field(default_factory=lambda: dict(DEFAULT_DENSITY_SCALES))
    # Factor weights (0-1)
    weights: dict[str, float] = field(default_factory=lambda: dict(DEFAULT_WEIGHTS))
    # Minimum factor thresholds (non-compensatory constraints).
    # A hex must meet ALL active thresholds to be considered as a candidate.
    # Keys match factor keys; values are minimum score (0-1).
    # Empty dict = no thresholds (fully compensatory, the default).
    min_thresholds: dict[str, float] = field(default_factory=dict)
    # Existing stations (optimizer places new stations around these)
    existing_stations: list[dict] = field(default_factory=list)  # [{lat, lng, capacity}]


@dataclass
class PlannedStation:
    id: str
    name: str
    lat: float
    lng: float
    capacity: int
    bikes: int
    suitability: float
    h3: str


@dataclass
class OptimizeResult:
    stations: list[PlannedStation]
    coverage: dict[str, Any]
    solve_time_s: float


def _compute_base_suitability(
    features: list[dict],
    config: OptimizeConfig,
) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    """Compute per-hex suitability from weights + decay/density config, plus centroids.

    Returns (suitability, centroids_lat, centroids_lng) — all length-n arrays.

    Scoring modes:
      - Density factors (commercial, education, recreation): log normalization
        of POI count within radius.
      - Proximity factors (lrt, bike_infra, transit): negative-exponential decay
        from nearest feature (score = exp(-4.6 * d / radius)).
      - Direct factors (population): pre-computed score used directly.

    Non-routable hexes (river, rail, highway) are forced to suitability = 0.
    """
    n = len(features)
    weights = config.weights
    total_weight = sum(weights.values()) or 1.0
    decay_radii = config.decay_radii
    density_scales = config.density_scales
    min_thresholds = config.min_thresholds

    suitability = np.zeros(n)
    for i, feat in enumerate(features):
        props = feat["properties"]

        # Hard constraint: non-routable hexes get zero suitability
        if not props.get("routable", True):
            continue

        factor_scores: dict[str, float] = {}
        for key, w in weights.items():
            net_count_key = f"{key}_network_count"
            count_key = f"{key}_count"
            net_dist_key = f"{key}_network_dist"
            dist_key = f"{key}_dist"

            if key in density_scales and (net_count_key in props or count_key in props):
                count = props.get(net_count_key, props.get(count_key, 0))
                scale = density_scales[key]
                factor_scores[key] = (
                    min(1.0, math.log1p(count) / math.log1p(scale))
                    if scale > 0 else 0.0
                )
            elif key in decay_radii and (net_dist_key in props or dist_key in props):
                dist = props.get(net_dist_key)
                if dist is None or dist is False:
                    dist = props.get(dist_key, float("inf"))
                radius = decay_radii[key]
                if radius > 0 and dist != float("inf") and dist is not None:
                    beta = 4.6 / radius
                    factor_scores[key] = math.exp(-beta * dist)
                else:
                    factor_scores[key] = 0.0
            else:
                factor_scores[key] = props.get(key, 0.0)

        # Non-compensatory threshold check: hex must meet ALL active thresholds
        if min_thresholds:
            failed = False
            for tkey, tmin in min_thresholds.items():
                if tkey in factor_scores and factor_scores[tkey] < tmin:
                    failed = True
                    break
            if failed:
                continue

        score = sum(w * factor_scores.get(key, 0.0) for key, w in weights.items())
        suitability[i] = score / total_weight

    centroids_lat = np.zeros(n)
    centroids_lng = np.zeros(n)
    for i, feat in enumerate(features):
        ring = feat["geometry"]["coordinates"][0]
        centroids_lat[i] = sum(c[1] for c in ring[:-1]) / (len(ring) - 1)
        centroids_lng[i] = sum(c[0] for c in ring[:-1]) / (len(ring) - 1)

    return suitability, centroids_lat, centroids_lng


def _apply_station_modifiers(
    suitability: np.ndarray,
    centroids_lat: np.ndarray,
    centroids_lng: np.ndarray,
    all_stations: list[dict],
    config: OptimizeConfig,
) -> np.ndarray:
    """Apply proximity discount + connectivity penalty relative to a set of stations.

    Returns a *copy* of suitability with modifiers applied.
    """
    suit = suitability.copy()
    if not all_stations:
        return suit

    ex_lats = np.array([s["lat"] for s in all_stations])
    ex_lngs = np.array([s["lng"] for s in all_stations])
    dist_to_existing = _min_distances_m(centroids_lat, centroids_lng, ex_lats, ex_lngs)

    # Proximity discount: too close → penalty
    if config.proximity_discount_strength > 0 and config.proximity_discount_radius > 0:
        radius = config.proximity_discount_radius
        strength = config.proximity_discount_strength
        discount = np.where(
            dist_to_existing < radius,
            1.0 - strength * (1.0 - dist_to_existing / radius),
            1.0,
        )
        suit *= discount

    # Connectivity penalty: too far → penalty
    if config.connectivity_strength > 0 and config.connectivity_radius > 0:
        conn_r = config.connectivity_radius
        conn_s = config.connectivity_strength
        excess = np.clip(dist_to_existing - conn_r, 0, None)
        decay = np.minimum(excess / conn_r, 1.0)
        connectivity = 1.0 - conn_s * decay
        suit *= connectivity

    return suit


def _solve_mclp_batch(
    features: list[dict],
    centroids_lat: np.ndarray,
    centroids_lng: np.ndarray,
    suitability: np.ndarray,
    all_existing: list[dict],
    budget: int,
    config: OptimizeConfig,
) -> tuple[list[PlannedStation], str]:
    """Run a single MCLP solve for `budget` stations.

    Returns (placed_stations, solver_status_name).

    To keep the CP-SAT model tractable we pre-filter to the top candidates
    by suitability score and subsample demand hexes.  This limits the
    distance matrix and pairwise constraint count while preserving quality
    (the solver is only picking ``budget`` from the pool).
    """
    threshold = 0.05

    # ---- Pre-filter candidates (top MAX_CANDIDATES by suitability) --------
    MAX_CANDIDATES = 500  # keeps CP-SAT fast (<5 s per batch)
    MAX_DEMAND = 2000     # keeps distance matrix / constraints manageable

    demand_mask = suitability > 0.01
    candidate_mask = suitability >= threshold

    # Also pre-block candidates too close to existing stations (avoids
    # adding them to the model only to hard-constrain them to 0).
    if all_existing:
        ex_lats = np.array([s["lat"] for s in all_existing])
        ex_lngs = np.array([s["lng"] for s in all_existing])
        dist_to_ex = _min_distances_m(
            centroids_lat, centroids_lng, ex_lats, ex_lngs
        )
        candidate_mask = candidate_mask & (dist_to_ex >= config.min_spacing_m)

    demand_idx = np.where(demand_mask)[0]
    candidate_idx = np.where(candidate_mask)[0]

    if len(candidate_idx) == 0 or len(demand_idx) == 0:
        return [], "NO_CANDIDATES"

    # Keep only the top candidates by suitability
    if len(candidate_idx) > MAX_CANDIDATES:
        top_order = np.argsort(suitability[candidate_idx])[::-1][:MAX_CANDIDATES]
        candidate_idx = candidate_idx[top_order]

    # Subsample demand: keep top demand hexes by suitability
    if len(demand_idx) > MAX_DEMAND:
        top_d_order = np.argsort(suitability[demand_idx])[::-1][:MAX_DEMAND]
        demand_idx = demand_idx[top_d_order]

    nc = len(candidate_idx)
    nd = len(demand_idx)
    print(f"[Planner/MCLP]   Model size: {nd} demand × {nc} candidates")

    # Distance matrix (demand × candidates)
    d_lat = centroids_lat[demand_idx][:, None] - centroids_lat[candidate_idx][None, :]
    d_lng = centroids_lng[demand_idx][:, None] - centroids_lng[candidate_idx][None, :]
    dist_m = np.sqrt((d_lat * _LAT_M) ** 2 + (d_lng * _LNG_M) ** 2)
    coverage_mask = dist_m <= config.coverage_radius_m

    c_lat = centroids_lat[candidate_idx]
    c_lng = centroids_lng[candidate_idx]

    # Build CP-SAT model
    model = cp_model.CpModel()
    x = [model.NewBoolVar(f"x_{j}") for j in range(nc)]
    y = [model.NewBoolVar(f"y_{i}") for i in range(nd)]

    for i in range(nd):
        covering_j = list(np.where(coverage_mask[i])[0])
        if covering_j:
            model.Add(y[i] <= sum(x[j] for j in covering_j))
        else:
            model.Add(y[i] == 0)

    model.Add(sum(x) <= budget)

    # Min spacing: between candidate pairs
    cx_m = c_lat * _LAT_M
    cy_m = c_lng * _LNG_M
    _PAIR_BATCH = 2000
    for i0 in range(0, nc, _PAIR_BATCH):
        i1 = min(i0 + _PAIR_BATCH, nc)
        dx = cx_m[i0:i1, None] - cx_m[None, :]
        dy = cy_m[i0:i1, None] - cy_m[None, :]
        d = np.sqrt(dx * dx + dy * dy)
        for local_j1 in range(i1 - i0):
            global_j1 = i0 + local_j1
            too_close = np.where(d[local_j1, global_j1 + 1:] < config.min_spacing_m)[0]
            for offset in too_close:
                j2 = global_j1 + 1 + offset
                model.Add(x[global_j1] + x[j2] <= 1)

    # (spacing vs existing already enforced via candidate_mask above)

    # Objective: maximize suitability-weighted coverage
    SCALE = 10000
    demand_weights = (suitability[demand_idx] * SCALE).astype(int)
    model.Maximize(sum(int(demand_weights[i]) * y[i] for i in range(nd)))

    solver = cp_model.CpSolver()
    solver.parameters.max_time_in_seconds = config.max_solve_seconds
    solver.parameters.num_workers = 4
    status = solver.Solve(model)

    if status not in (cp_model.OPTIMAL, cp_model.FEASIBLE):
        return [], solver.StatusName(status)

    selected_j = [j for j in range(nc) if solver.Value(x[j])]

    stations: list[PlannedStation] = []
    for rank, j in enumerate(selected_j, 1):
        ci = candidate_idx[j]
        feat = features[ci]
        stations.append(PlannedStation(
            id=f"auto_{uuid.uuid4().hex[:8]}",
            name="",  # named later
            lat=round(float(centroids_lat[ci]), 6),
            lng=round(float(centroids_lng[ci]), 6),
            capacity=0,
            bikes=0,
            suitability=round(float(suitability[ci]), 4),
            h3=feat["properties"]["h3"],
        ))

    return stations, solver.StatusName(status)


def _solve_greedy(
    features: list[dict],
    centroids_lat: np.ndarray,
    centroids_lng: np.ndarray,
    base_suitability: np.ndarray,
    config: OptimizeConfig,
) -> list[PlannedStation]:
    """Greedy algorithm: place one station at a time, recomputing suitability each step.

    At each iteration:
      1. Recompute suitability with proximity/connectivity from ALL placed stations
      2. Mask out hexes within min_spacing of any placed station
      3. Pick the hex with the highest suitability
    """
    all_placed: list[dict] = list(config.existing_stations or [])
    stations: list[PlannedStation] = []

    for step in range(config.num_stations):
        # Recompute suitability with modifiers from ALL stations placed so far
        suit = _apply_station_modifiers(
            base_suitability, centroids_lat, centroids_lng, all_placed, config
        )

        # Mask out hexes within min_spacing of any placed station
        if all_placed:
            ex_lats = np.array([s["lat"] for s in all_placed])
            ex_lngs = np.array([s["lng"] for s in all_placed])
            dist_to_existing = _min_distances_m(centroids_lat, centroids_lng, ex_lats, ex_lngs)
            suit[dist_to_existing < config.min_spacing_m] = 0.0

        # Pick the best hex
        best_idx = int(np.argmax(suit))
        best_score = float(suit[best_idx])

        if best_score <= 0:
            print(f"[Planner/Greedy] Step {step + 1}: no viable candidates left, stopping")
            break

        lat = round(float(centroids_lat[best_idx]), 6)
        lng = round(float(centroids_lng[best_idx]), 6)
        feat = features[best_idx]

        stations.append(PlannedStation(
            id=f"auto_{uuid.uuid4().hex[:8]}",
            name="",  # named later
            lat=lat,
            lng=lng,
            capacity=0,
            bikes=0,
            suitability=round(best_score, 4),
            h3=feat["properties"]["h3"],
        ))
        all_placed.append({"lat": lat, "lng": lng, "capacity": 0})

        if (step + 1) % 10 == 0 or step == 0:
            print(f"[Planner/Greedy] Step {step + 1}/{config.num_stations}: "
                  f"placed at ({lat}, {lng}), score={best_score:.3f}")

    return stations


def step_greedy_one(
    hex_grid: dict,
    config: OptimizeConfig,
) -> PlannedStation | None:
    """Place a single station at the greedily optimal location.

    Lightweight version of the greedy algorithm for interactive stepping.
    Returns None if no viable candidate exists.
    """
    features = hex_grid["features"]
    base_suit, centroids_lat, centroids_lng = _compute_base_suitability(features, config)

    # Apply proximity/connectivity from existing stations
    suit = _apply_station_modifiers(
        base_suit, centroids_lat, centroids_lng,
        list(config.existing_stations or []), config,
    )

    # Hard spacing mask
    if config.existing_stations:
        ex_lats = np.array([s["lat"] for s in config.existing_stations])
        ex_lngs = np.array([s["lng"] for s in config.existing_stations])
        dist = _min_distances_m(centroids_lat, centroids_lng, ex_lats, ex_lngs)
        suit[dist < config.min_spacing_m] = 0.0

    best_idx = int(np.argmax(suit))
    best_score = float(suit[best_idx])
    if best_score <= 0:
        return None

    lat = round(float(centroids_lat[best_idx]), 6)
    lng = round(float(centroids_lng[best_idx]), 6)
    feat = features[best_idx]

    # Default capacity: midpoint of min/max docks
    cap = int(round((config.min_docks_per_station + config.max_docks_per_station) / 2 / 5) * 5)
    cap = max(config.min_docks_per_station, min(config.max_docks_per_station, cap))
    bikes = max(1, int(round(cap * config.target_fill_pct)))

    return PlannedStation(
        id=f"auto_{uuid.uuid4().hex[:8]}",
        name="Station (step)",
        lat=lat,
        lng=lng,
        capacity=cap,
        bikes=bikes,
        suitability=round(best_score, 4),
        h3=feat["properties"]["h3"],
    )


def optimize_network(
    hex_grid: dict,
    config: OptimizeConfig,
) -> OptimizeResult:
    """Run the selected optimization algorithm.

    Dispatches to either iterative MCLP or greedy based on config.algorithm.
    """
    t0 = time.time()
    features = hex_grid["features"]

    # 1. Compute base suitability (without station modifiers)
    base_suitability, centroids_lat, centroids_lng = _compute_base_suitability(
        features, config
    )

    print(f"[Planner] Algorithm: {config.algorithm}"
          + (f" (batch_size={config.batch_size})" if config.algorithm == "iterative_mclp" else ""))

    # 2. Dispatch to algorithm
    if config.algorithm == "greedy":
        stations = _solve_greedy(
            features, centroids_lat, centroids_lng, base_suitability, config
        )
        solve_status = "GREEDY"
    else:
        # Iterative MCLP: solve in batches, recomputing suitability between batches
        all_placed: list[dict] = list(config.existing_stations or [])
        stations: list[PlannedStation] = []
        remaining = config.num_stations
        batch_num = 0
        solve_status = "FEASIBLE"

        # Budget solve-time across batches so total stays reasonable.
        # Allow up to ~45 s of total CP-SAT time regardless of batch count.
        _TOTAL_SOLVE_BUDGET = 45.0
        num_batches = math.ceil(config.num_stations / max(config.batch_size, 1))
        per_batch_time = max(2.0, min(config.max_solve_seconds,
                                       _TOTAL_SOLVE_BUDGET / max(num_batches, 1)))
        original_max_solve = config.max_solve_seconds
        config.max_solve_seconds = per_batch_time
        print(f"[Planner/MCLP] {num_batches} batches planned, "
              f"{per_batch_time:.1f}s per batch (budget {_TOTAL_SOLVE_BUDGET:.0f}s)")

        while remaining > 0:
            batch_num += 1
            batch_budget = min(remaining, config.batch_size)

            # Recompute suitability with modifiers from ALL placed stations
            suit = _apply_station_modifiers(
                base_suitability, centroids_lat, centroids_lng, all_placed, config
            )

            print(f"[Planner/MCLP] Batch {batch_num}: placing up to {batch_budget} stations "
                  f"({len(all_placed)} existing)")

            batch_stations, status_name = _solve_mclp_batch(
                features, centroids_lat, centroids_lng, suit,
                all_placed, batch_budget, config,
            )

            if not batch_stations:
                print(f"[Planner/MCLP] Batch {batch_num}: solver returned 0 stations "
                      f"(status={status_name}), stopping")
                solve_status = status_name
                break

            solve_status = status_name
            stations.extend(batch_stations)
            remaining -= len(batch_stations)

            # Add newly placed to "existing" for next batch
            for s in batch_stations:
                all_placed.append({"lat": s.lat, "lng": s.lng, "capacity": 0})

            print(f"[Planner/MCLP] Batch {batch_num}: placed {len(batch_stations)} stations")

        config.max_solve_seconds = original_max_solve  # restore

    # 3. Name stations sequentially
    for i, s in enumerate(stations, 1):
        s.name = f"Station {i}"

    # 4. Size capacity
    stations = size_capacity(stations, config)

    # 5. Compute coverage statistics
    demand_mask = base_suitability > 0.01
    demand_idx = np.where(demand_mask)[0]
    nd = len(demand_idx)

    # Coverage: which demand hexes are within coverage_radius of any placed station
    if stations:
        placed_lats = np.array([s.lat for s in stations])
        placed_lngs = np.array([s.lng for s in stations])
        dist_to_placed = _min_distances_m(
            centroids_lat[demand_idx], centroids_lng[demand_idx],
            placed_lats, placed_lngs,
        )
        covered_mask = dist_to_placed <= config.coverage_radius_m
        covered_i = np.where(covered_mask)[0]
    else:
        covered_i = np.array([], dtype=int)

    total_demand = float(base_suitability[demand_idx].sum())
    covered_demand = float(base_suitability[demand_idx[covered_i]].sum()) if len(covered_i) > 0 else 0.0

    pop_factor_scores = np.array([
        features[demand_idx[i]]["properties"].get("population", 0) for i in range(nd)
    ])
    total_pop_score = float(pop_factor_scores.sum())
    covered_pop_score = float(pop_factor_scores[covered_i].sum()) if len(covered_i) > 0 else 0.0

    total_bikes_placed = sum(s.bikes for s in stations)
    total_docks_placed = sum(s.capacity for s in stations)
    solve_time = time.time() - t0

    coverage: dict[str, Any] = {
        "demand_covered_pct": round(covered_demand / max(total_demand, 1) * 100, 1),
        "hexes_covered": int(len(covered_i)),
        "hexes_total": nd,
        "stations_placed": len(stations),
        "total_bikes": total_bikes_placed,
        "total_docks": total_docks_placed,
        "avg_docks_per_station": round(total_docks_placed / max(len(stations), 1), 1),
        "solve_status": solve_status,
    }
    if total_pop_score > 0:
        coverage["population_covered_pct"] = round(
            covered_pop_score / total_pop_score * 100, 1
        )

    if stations:
        placed_lats_list = [s.lat for s in stations]
        placed_lngs_list = [s.lng for s in stations]
        print(f"[Planner] Placed stations bbox — "
              f"lat=[{min(placed_lats_list):.4f}, {max(placed_lats_list):.4f}], "
              f"lng=[{min(placed_lngs_list):.4f}, {max(placed_lngs_list):.4f}]")

    print(f"[Planner] Solved in {solve_time:.1f}s: {len(stations)} stations, "
          f"{coverage['demand_covered_pct']}% demand covered")

    return OptimizeResult(stations=stations, coverage=coverage, solve_time_s=solve_time)


# ---------------------------------------------------------------------------
# Capacity sizer
# ---------------------------------------------------------------------------


def size_capacity(
    stations: list[PlannedStation],
    config: OptimizeConfig,
) -> list[PlannedStation]:
    """Assign dock capacity and initial bike count based on relative demand.

    Strategy:
      1. Distribute total docks proportional to each station's suitability score.
      2. Clamp each station to [min_docks, max_docks], snap to nearest 5.
      3. Distribute total_bikes proportional to capacity, scaled by target_fill_pct.
    """
    if not stations:
        return stations

    n = len(stations)
    scores = np.array([s.suitability for s in stations])
    scores_norm = scores / max(scores.sum(), 0.001)

    min_d = config.min_docks_per_station
    max_d = config.max_docks_per_station

    # --- Step 1: Compute raw dock share from total bike fleet ---
    # Total docks ≈ total_bikes / target_fill + headroom
    fill = max(0.1, min(0.9, config.target_fill_pct))
    total_docks_target = int(config.total_bikes / fill)

    capacities = np.zeros(n, dtype=int)
    for i in range(n):
        raw = scores_norm[i] * total_docks_target
        # Blend proportional share with a floor to avoid tiny stations
        raw = max(raw, min_d)
        clamped = min(max_d, max(min_d, raw))
        # Snap to nearest 5
        capacities[i] = int(round(clamped / 5) * 5)
        capacities[i] = max(min_d, min(max_d, capacities[i]))

    # --- Step 2: Distribute bikes proportional to capacity ---
    total_cap = int(capacities.sum())

    for i, station in enumerate(stations):
        station.capacity = int(capacities[i])
        # Proportional bike allocation
        if total_cap > 0:
            share = capacities[i] / total_cap
            bikes = int(round(share * config.total_bikes))
        else:
            bikes = 0
        # Ensure within bounds
        station.bikes = max(1, min(bikes, station.capacity))

    return stations
