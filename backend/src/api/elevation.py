"""
Elevation profile computation using the Open-Meteo Elevation API.

Open-Meteo is free, no API key required, and supports batch queries.
We sample points along a polyline at regular intervals, query their
elevations, then return a distance-vs-elevation profile.
"""

from __future__ import annotations

import math
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from src.config import settings

router = APIRouter(prefix="/api/elevation", tags=["elevation"])

OPEN_METEO_URL = "https://api.open-meteo.com/v1/elevation"
SAMPLE_INTERVAL_M = 50  # metres between elevation samples
MAX_POINTS_PER_BATCH = 100  # Open-Meteo limit per request

_open_meteo_reachable: bool | None = None


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------


class ElevationPoint(BaseModel):
    distance_m: float
    elevation_m: float


class ElevationProfile(BaseModel):
    profile: list[ElevationPoint]
    total_ascent_m: float
    total_descent_m: float
    min_elevation_m: float
    max_elevation_m: float


# ---------------------------------------------------------------------------
# Geometry helpers
# ---------------------------------------------------------------------------


def _haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _interpolate(
    lat1: float, lng1: float,
    lat2: float, lng2: float,
    frac: float,
) -> tuple[float, float]:
    """Linear interpolation between two points."""
    return (lat1 + (lat2 - lat1) * frac, lng1 + (lng2 - lng1) * frac)


def sample_along_path(
    coords: list[tuple[float, float]],
    interval_m: float = SAMPLE_INTERVAL_M,
) -> list[dict[str, float]]:
    """
    Sample points at regular intervals along a path.

    coords: list of (lat, lng) tuples
    Returns: list of {"lat", "lng", "distance_m"} dicts
    """
    if not coords:
        return []

    samples: list[dict[str, float]] = [
        {"lat": coords[0][0], "lng": coords[0][1], "distance_m": 0.0}
    ]

    cum_dist = 0.0
    next_sample = interval_m

    for i in range(1, len(coords)):
        seg_len = _haversine_m(
            coords[i - 1][0], coords[i - 1][1],
            coords[i][0], coords[i][1],
        )
        seg_start_dist = cum_dist

        while cum_dist + seg_len >= next_sample:
            frac = (next_sample - cum_dist) / seg_len if seg_len > 0 else 0
            lat, lng = _interpolate(
                coords[i - 1][0], coords[i - 1][1],
                coords[i][0], coords[i][1],
                frac,
            )
            samples.append({"lat": lat, "lng": lng, "distance_m": next_sample})
            next_sample += interval_m

        cum_dist += seg_len

    # Always include the last point
    last = coords[-1]
    if not samples or abs(samples[-1]["distance_m"] - cum_dist) > 1:
        samples.append({"lat": last[0], "lng": last[1], "distance_m": cum_dist})

    return samples


# ---------------------------------------------------------------------------
# Elevation query
# ---------------------------------------------------------------------------


async def query_elevations(
    points: list[tuple[float, float]],
    client: httpx.AsyncClient | None = None,
) -> list[float]:
    """
    Query elevations for a list of (lat, lng) points.
    Returns a list of elevation values in metres.
    """
    global _open_meteo_reachable
    if not points or _open_meteo_reachable is False:
        return []

    own_client = client is None
    if own_client:
        client = httpx.AsyncClient(timeout=httpx.Timeout(connect=3.0, read=12.0, write=5.0, pool=5.0))

    try:
        elevations: list[float] = []

        for start in range(0, len(points), MAX_POINTS_PER_BATCH):
            batch = points[start : start + MAX_POINTS_PER_BATCH]
            lats = ",".join(f"{p[0]:.6f}" for p in batch)
            lngs = ",".join(f"{p[1]:.6f}" for p in batch)

            resp = await client.get(
                OPEN_METEO_URL,
                params={"latitude": lats, "longitude": lngs},
                headers={"User-Agent": f"{settings.app_name}/0.2"},
            )
            resp.raise_for_status()
            _open_meteo_reachable = True
            data = resp.json()

            batch_elevations = data.get("elevation", [])
            if isinstance(batch_elevations, (int, float)):
                batch_elevations = [batch_elevations]
            elevations.extend(batch_elevations)

        return elevations
    except (httpx.ConnectTimeout, httpx.ConnectError, OSError):
        _open_meteo_reachable = False
        print("[elevation] Open-Meteo unreachable — elevation profiles disabled for this session")
        return []
    finally:
        if own_client:
            await client.aclose()


# ---------------------------------------------------------------------------
# Full profile computation
# ---------------------------------------------------------------------------


async def compute_elevation_profile(
    coords: list[tuple[float, float]],
    client: httpx.AsyncClient | None = None,
    interval_m: float = SAMPLE_INTERVAL_M,
) -> ElevationProfile:
    """
    Given a polyline as (lat, lng) tuples, compute the elevation profile.
    """
    samples = sample_along_path(coords, interval_m)

    if len(samples) < 2:
        elev = 0.0
        if samples:
            try:
                vals = await query_elevations(
                    [(samples[0]["lat"], samples[0]["lng"])], client
                )
                elev = vals[0] if vals else 0.0
            except Exception:
                pass
        return ElevationProfile(
            profile=[ElevationPoint(distance_m=0, elevation_m=elev)],
            total_ascent_m=0,
            total_descent_m=0,
            min_elevation_m=elev,
            max_elevation_m=elev,
        )

    points = [(s["lat"], s["lng"]) for s in samples]

    try:
        elevations = await query_elevations(points, client)
    except Exception:
        # Fallback: flat profile
        return ElevationProfile(
            profile=[
                ElevationPoint(distance_m=s["distance_m"], elevation_m=0)
                for s in samples
            ],
            total_ascent_m=0,
            total_descent_m=0,
            min_elevation_m=0,
            max_elevation_m=0,
        )

    profile: list[ElevationPoint] = []
    for i, s in enumerate(samples):
        elev = elevations[i] if i < len(elevations) else 0.0
        profile.append(ElevationPoint(distance_m=s["distance_m"], elevation_m=elev))

    # Compute ascent/descent
    ascent = 0.0
    descent = 0.0
    for i in range(1, len(profile)):
        diff = profile[i].elevation_m - profile[i - 1].elevation_m
        if diff > 0:
            ascent += diff
        else:
            descent += abs(diff)

    elevs = [p.elevation_m for p in profile]

    return ElevationProfile(
        profile=profile,
        total_ascent_m=round(ascent, 1),
        total_descent_m=round(descent, 1),
        min_elevation_m=round(min(elevs), 1),
        max_elevation_m=round(max(elevs), 1),
    )


# ---------------------------------------------------------------------------
# Standalone endpoint (for on-demand profile queries)
# ---------------------------------------------------------------------------


class ProfileRequest(BaseModel):
    """Request body: list of [lng, lat] coordinate pairs (GeoJSON order)."""
    coordinates: list[list[float]]


@router.post("/profile", response_model=ElevationProfile)
async def get_elevation_profile(req: ProfileRequest) -> ElevationProfile:
    """Compute elevation profile for a polyline."""
    # Convert from [lng, lat] (GeoJSON) to (lat, lng) tuples
    coords = [(c[1], c[0]) for c in req.coordinates if len(c) >= 2]
    return await compute_elevation_profile(coords)
