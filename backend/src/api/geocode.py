"""
Geocoding API — uses Photon (Komoot) as primary geocoder.

Photon is built on OSM data and is optimized for autocomplete:
~50-100ms responses vs 500-1500ms for Nominatim.
"""

from __future__ import annotations

from fastapi import APIRouter, Query
import httpx

from src.api.cache import geocode_cache

router = APIRouter(prefix="/api/geocode", tags=["geocode"])

# Photon (fast, autocomplete-optimized, free, no key)
PHOTON_URL = "https://photon.komoot.io/api/"
PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse"

# Edmonton center for location biasing
EDMONTON_LAT = 53.5461
EDMONTON_LNG = -113.4937

# Edmonton bounding box for filtering
BBOX = {"min_lat": 53.39, "max_lat": 53.72, "min_lng": -113.71, "max_lng": -113.27}


def _build_label(props: dict) -> str:
    """Build a human-readable label from Photon feature properties."""
    parts = []
    name = props.get("name")
    housenumber = props.get("housenumber")
    street = props.get("street")

    if name:
        parts.append(name)
    if housenumber and street:
        addr = f"{housenumber} {street}"
        if addr != name:
            parts.append(addr)
    elif street and street != name:
        parts.append(street)

    city = props.get("city", "")
    if city and city not in parts:
        parts.append(city)

    state = props.get("state", "")
    if state:
        parts.append(state)

    return ", ".join(parts) if parts else "Unknown location"


@router.get("")
async def geocode(
    q: str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(5, ge=1, le=10),
) -> list[dict]:
    """
    Geocode an address/place name scoped to Edmonton. Uses Photon for speed.
    """
    cache_key = f"{q.lower().strip()}:{limit}"
    cached = geocode_cache.get("fwd", cache_key)
    if cached is not None:
        return cached

    params = {
        "q": q,
        "lat": EDMONTON_LAT,
        "lon": EDMONTON_LNG,
        "limit": limit + 5,  # fetch extra, filter by bbox
        "lang": "en",
    }
    headers = {"User-Agent": "BikeShareYEG/0.1"}

    async with httpx.AsyncClient(timeout=5) as client:
        resp = await client.get(PHOTON_URL, params=params, headers=headers)
        resp.raise_for_status()
        data = resp.json()

    results = []
    for feat in data.get("features", []):
        coords = feat.get("geometry", {}).get("coordinates", [])
        if len(coords) < 2:
            continue
        lng, lat = coords[0], coords[1]

        # Filter to Edmonton bounding box
        if not (BBOX["min_lat"] <= lat <= BBOX["max_lat"]
                and BBOX["min_lng"] <= lng <= BBOX["max_lng"]):
            continue

        props = feat.get("properties", {})
        results.append({
            "label": _build_label(props),
            "lat": lat,
            "lng": lng,
            "type": props.get("osm_value", props.get("type", "unknown")),
        })

        if len(results) >= limit:
            break

    geocode_cache.put("fwd", cache_key, results)
    return results


@router.get("/reverse")
async def reverse_geocode(
    lat: float = Query(...),
    lng: float = Query(...),
) -> dict:
    """Reverse-geocode a lat/lng to an address label."""
    params = {"lat": lat, "lon": lng}
    headers = {"User-Agent": "BikeShareYEG/0.1"}

    try:
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(PHOTON_REVERSE_URL, params=params, headers=headers)
            resp.raise_for_status()
            data = resp.json()

        features = data.get("features", [])
        if features:
            props = features[0].get("properties", {})
            return {"label": _build_label(props), "lat": lat, "lng": lng}
    except Exception:
        pass

    return {"label": f"{lat:.5f}, {lng:.5f}", "lat": lat, "lng": lng}
