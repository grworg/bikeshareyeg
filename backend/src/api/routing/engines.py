"""Low-level routing engines: BRouter, OSRM, OTP point-to-point, straight-line.

The `route()` function tries each engine in order, falling back to the next
if unreachable: BRouter → OSRM → OTP → straight-line.
"""

from __future__ import annotations

import httpx

from src.data.otp import plan as otp_plan, is_available as otp_is_available
from src.api.cache import route_cache
from src.api.routing.models import LatLng
from src.api.routing.helpers import haversine_m

OSRM_BASE = "https://router.project-osrm.org/route/v1"
BROUTER_URL = "https://brouter.de/brouter"

EXTERNAL_TIMEOUT = httpx.Timeout(connect=3.0, read=12.0, write=5.0, pool=5.0)

BROUTER_PROFILES = {"walk": "shortest", "bike": "safety"}

# After the first connection failure, skip the service for all subsequent calls.
_brouter_reachable: bool | None = None
_osrm_reachable: bool | None = None


async def _brouter_route(
    mode: str, origin: LatLng, dest: LatLng, client: httpx.AsyncClient,
) -> dict | None:
    global _brouter_reachable
    if _brouter_reachable is False:
        return None
    profile = BROUTER_PROFILES.get(mode, "trekking")
    lonlats = f"{origin.lng},{origin.lat}|{dest.lng},{dest.lat}"
    params = {
        "lonlats": lonlats, "profile": profile,
        "alternativeidx": "0", "format": "geojson",
    }
    try:
        resp = await client.get(BROUTER_URL, params=params, timeout=EXTERNAL_TIMEOUT)
        resp.raise_for_status()
        _brouter_reachable = True
        data = resp.json()
        features = data.get("features", [])
        if not features:
            return None
        feature = features[0]
        props = feature.get("properties", {})
        geometry = feature["geometry"]
        if geometry.get("type") == "LineString":
            geometry = {
                "type": "LineString",
                "coordinates": [c[:2] for c in geometry.get("coordinates", [])],
            }
        return {
            "geometry": geometry,
            "distance_m": float(props.get("track-length", 0)),
            "duration_s": float(props.get("total-time", 0)),
        }
    except (httpx.ConnectTimeout, httpx.ConnectError, OSError):
        _brouter_reachable = False
        print("[routing] BRouter unreachable — using straight-line fallback for all future requests")
        return None
    except Exception:
        return None


async def _osrm_route(
    profile: str, origin: LatLng, dest: LatLng, client: httpx.AsyncClient,
) -> dict | None:
    global _osrm_reachable
    if _osrm_reachable is False:
        return None
    coords = f"{origin.lng},{origin.lat};{dest.lng},{dest.lat}"
    url = f"{OSRM_BASE}/{profile}/{coords}"
    try:
        resp = await client.get(url, params={"overview": "full", "geometries": "geojson"}, timeout=EXTERNAL_TIMEOUT)
        resp.raise_for_status()
        _osrm_reachable = True
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return None
        r = data["routes"][0]
        return {"geometry": r["geometry"], "distance_m": r["distance"], "duration_s": r["duration"]}
    except (httpx.ConnectTimeout, httpx.ConnectError, OSError):
        _osrm_reachable = False
        print("[routing] OSRM unreachable — using straight-line fallback for all future requests")
        return None
    except Exception:
        return None


async def _otp_route(mode: str, origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> dict | None:
    """Use OTP for simple walk/bike point-to-point routing via its OSM graph.

    OTP v2 WALK mode has a hard ~2 km limit.  For longer walks we request
    BICYCLE mode (no distance cap) and recalculate the duration at walking
    speed so the geometry still follows real streets.
    """
    if not await otp_is_available(client):
        return None
    from datetime import date as _date

    used_bike_fallback = False
    otp_mode = "WALK" if mode == "walk" else "BICYCLE"

    try:
        itineraries = await otp_plan(
            origin.lat, origin.lng, dest.lat, dest.lng,
            _date.today(), 12 * 3600,
            mode=otp_mode,
            num_itineraries=1,
            client=client,
        )

        if not itineraries and mode == "walk":
            itineraries = await otp_plan(
                origin.lat, origin.lng, dest.lat, dest.lng,
                _date.today(), 12 * 3600,
                mode="BICYCLE",
                num_itineraries=1,
                client=client,
            )
            used_bike_fallback = True

        if not itineraries:
            return None

        it = itineraries[0]
        coords: list[list[float]] = []
        total_dist = 0.0
        for leg in it.legs:
            for c in leg.geometry.get("coordinates", []):
                coords.append(c)
            total_dist += leg.distance_m
        if len(coords) < 2:
            return None

        duration = total_dist / 1.4 if used_bike_fallback else it.duration_s
        return {
            "geometry": {"type": "LineString", "coordinates": coords},
            "distance_m": total_dist,
            "duration_s": duration,
        }
    except Exception:
        return None


def _straight_line_fallback(mode: str, origin: LatLng, dest: LatLng) -> dict:
    dist = haversine_m(origin.lat, origin.lng, dest.lat, dest.lng)
    speed = 1.4 if mode == "walk" else 4.5
    return {
        "geometry": {"type": "LineString", "coordinates": [[origin.lng, origin.lat], [dest.lng, dest.lat]]},
        "distance_m": dist * 1.3,
        "duration_s": (dist * 1.3) / speed,
    }


async def route(mode: str, origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> dict:
    """Route a single walk or bike leg, trying engines in priority order."""
    cache_key = f"{mode}:{round(origin.lat, 4)},{round(origin.lng, 4)}:{round(dest.lat, 4)},{round(dest.lng, 4)}"
    cached = route_cache.get("route", cache_key)
    if cached is not None:
        return cached

    engine = "straight-line"
    result = await _brouter_route(mode, origin, dest, client)
    if result:
        engine = "brouter"
    else:
        osrm_profile = "foot" if mode == "walk" else "bicycle"
        result = await _osrm_route(osrm_profile, origin, dest, client)
        if result:
            engine = "osrm"
        else:
            result = await _otp_route(mode, origin, dest, client)
            if result:
                engine = "otp"
            else:
                result = _straight_line_fallback(mode, origin, dest)

    pts = len(result.get("geometry", {}).get("coordinates", []))
    print(f"[route] {mode} {result['distance_m']:.0f}m → {engine} ({pts} pts)")
    route_cache.put("route", cache_key, result)
    return result
