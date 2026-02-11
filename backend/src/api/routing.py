"""
Multi-modal route computation.

Modes:
  walk          — BRouter shortest profile, direct A→B
  bike          — BRouter safety profile, direct A→B
  bikeshare     — walk → bike-share bike → walk
  transit       — walk + transit (bus/LRT) via OTP, fallback to GTFS LRT-only
  transit_bike  — bike-share + transit combos via OTP, fallback to GTFS LRT-only

Uses BRouter (primary) / OSRM (fallback) for walk/bike legs.
Transit powered by OpenTripPlanner (bus + LRT), with GTFS LRT-only fallback.
Station state from src.data.stations (editable at runtime).
"""

from __future__ import annotations

import asyncio
import math
from datetime import date, datetime
from typing import Any

import httpx
from fastapi import APIRouter
from pydantic import BaseModel

from src.data.stations import get_stations
from src.data.otp import (
    plan as otp_plan,
    is_available as otp_is_available,
    otp_mode_to_leg_mode,
    OTPItinerary,
    OTPLeg as _OTPLeg,
)
from src.data.gtfs import (
    find_nearest_lrt_stops,
    find_lrt_journeys,
    haversine_m as _gtfs_haversine,
    LRTJourneyLeg,
    LRTStop,
    _seconds_to_hhmm,
)
from src.api.elevation import ElevationPoint, compute_elevation_profile

router = APIRouter(prefix="/api/routes", tags=["routing"])

OSRM_BASE = "https://router.project-osrm.org/route/v1"
BROUTER_URL = "https://brouter.de/brouter"
MAX_WALK_TO_STATION_M = 1500   # max walk to a bike-share station
MAX_WALK_TO_LRT_M = 2000      # max walk to an LRT stop
MAX_BIKE_TO_LRT_M = 3000      # max bike-share ride to an LRT stop
MAX_WALK_BS_TO_STOP_M = 800   # max walk between bike-share dock & transit stop


# ---------------------------------------------------------------------------
# Pydantic models
# ---------------------------------------------------------------------------

class LatLng(BaseModel):
    lat: float
    lng: float


class RoutesRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    modes: list[str] = ["walk", "bike", "bikeshare", "transit", "transit_bike"]
    departure_time: str | None = None  # ISO format: "2026-02-09T08:30" or None for now


class RouteLeg(BaseModel):
    mode: str  # "walk" | "bike" | "bus" | "lrt" | "wait"
    geometry: dict  # GeoJSON LineString
    distance_m: float
    duration_s: float
    # Transit-specific fields (bus/lrt — unified)
    transit_route: str | None = None       # route name "9 Southgate" / "Capital Line"
    transit_color: str | None = None       # hex color without #
    transit_headsign: str | None = None    # destination headsign
    transit_board_stop: str | None = None  # boarding stop name
    transit_alight_stop: str | None = None # alighting stop name
    transit_board_time: str | None = None  # "HH:MM"
    transit_alight_time: str | None = None # "HH:MM"
    transit_num_stops: int | None = None   # number of stops in this leg
    # Wait leg
    wait_until: str | None = None  # "HH:MM"


class StationRef(BaseModel):
    id: str
    name: str
    lat: float
    lng: float
    bikes: int
    capacity: int


class RouteOption(BaseModel):
    mode: str  # "walk" | "bike" | "bikeshare" | "transit" | "transit_bike"
    legs: list[RouteLeg]
    total_distance_m: float
    total_duration_s: float
    walk_distance_m: float
    summary: str
    pickup_station: StationRef | None = None
    dropoff_station: StationRef | None = None
    departure_time: str | None = None  # "HH:MM" when the journey starts
    arrival_time: str | None = None    # "HH:MM" estimated arrival
    # Elevation (populated after route computation)
    elevation_profile: list[ElevationPoint] | None = None
    total_ascent_m: float | None = None
    total_descent_m: float | None = None
    min_elevation_m: float | None = None
    max_elevation_m: float | None = None


class RoutesResponse(BaseModel):
    routes: list[RouteOption]
    notices: list[str] = []  # e.g. "No transit service at this time"


# ---------------------------------------------------------------------------
# Helpers
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


def _fmt_dist(m: float) -> str:
    if m >= 1000:
        return f"{m / 1000:.1f} km"
    return f"{m:.0f} m"


def _fmt_time(s: float) -> str:
    mins = round(s / 60)
    if mins < 1:
        return "< 1 min"
    if mins >= 60:
        h, m = divmod(mins, 60)
        return f"{h} h {m} min" if m else f"{h} h"
    return f"{mins} min"


def _epoch_ms_to_hhmm(ms: int) -> str:
    """Convert epoch milliseconds to HH:MM (local time)."""
    dt = datetime.fromtimestamp(ms / 1000)
    return f"{dt.hour:02d}:{dt.minute:02d}"


def _seconds_to_hhmm_local(s: int) -> str:
    """Seconds since midnight → HH:MM."""
    s = s % 86400
    h, m = divmod(s // 60, 60)
    return f"{h:02d}:{m:02d}"


def _parse_departure(dt_str: str | None) -> tuple[date, int]:
    """Parse departure_time string → (date, seconds_since_midnight).
    Returns current date/time if None."""
    now = datetime.now()
    if not dt_str:
        return now.date(), now.hour * 3600 + now.minute * 60 + now.second
    try:
        dt = datetime.fromisoformat(dt_str)
        return dt.date(), dt.hour * 3600 + dt.minute * 60 + dt.second
    except ValueError:
        return now.date(), now.hour * 3600 + now.minute * 60 + now.second


# ---------------------------------------------------------------------------
# Routing engines: BRouter / OSRM
# ---------------------------------------------------------------------------

BROUTER_PROFILES = {"walk": "shortest", "bike": "safety"}


async def _brouter_route(
    mode: str, origin: LatLng, dest: LatLng, client: httpx.AsyncClient,
) -> dict | None:
    profile = BROUTER_PROFILES.get(mode, "trekking")
    lonlats = f"{origin.lng},{origin.lat}|{dest.lng},{dest.lat}"
    params = {
        "lonlats": lonlats, "profile": profile,
        "alternativeidx": "0", "format": "geojson",
    }
    try:
        resp = await client.get(BROUTER_URL, params=params, timeout=15)
        resp.raise_for_status()
        data = resp.json()
        features = data.get("features", [])
        if not features:
            return None
        feature = features[0]
        props = feature.get("properties", {})
        # Strip Z (elevation) from coordinates — BRouter returns [lng, lat, elev]
        # which deck.gl interprets as altitude, causing the route to float above map.
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
    except Exception:
        return None


async def _osrm_route(
    profile: str, origin: LatLng, dest: LatLng, client: httpx.AsyncClient,
) -> dict | None:
    coords = f"{origin.lng},{origin.lat};{dest.lng},{dest.lat}"
    url = f"{OSRM_BASE}/{profile}/{coords}"
    try:
        resp = await client.get(url, params={"overview": "full", "geometries": "geojson"}, timeout=10)
        resp.raise_for_status()
        data = resp.json()
        if data.get("code") != "Ok" or not data.get("routes"):
            return None
        route = data["routes"][0]
        return {"geometry": route["geometry"], "distance_m": route["distance"], "duration_s": route["duration"]}
    except Exception:
        return None


def _straight_line_fallback(mode: str, origin: LatLng, dest: LatLng) -> dict:
    dist = _haversine_m(origin.lat, origin.lng, dest.lat, dest.lng)
    speed = 1.4 if mode == "walk" else 4.5
    return {
        "geometry": {"type": "LineString", "coordinates": [[origin.lng, origin.lat], [dest.lng, dest.lat]]},
        "distance_m": dist * 1.3,
        "duration_s": (dist * 1.3) / speed,
    }


async def _route(mode: str, origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> dict:
    result = await _brouter_route(mode, origin, dest, client)
    if result:
        return result
    osrm_profile = "foot" if mode == "walk" else "bicycle"
    result = await _osrm_route(osrm_profile, origin, dest, client)
    if result:
        return result
    return _straight_line_fallback(mode, origin, dest)


# ---------------------------------------------------------------------------
# Walk / Bike / Bikeshare route computation
# ---------------------------------------------------------------------------

async def _compute_walk(origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> RouteOption | None:
    result = await _route("walk", origin, dest, client)
    return RouteOption(
        mode="walk",
        legs=[RouteLeg(mode="walk", **result)],
        total_distance_m=result["distance_m"],
        total_duration_s=result["duration_s"],
        walk_distance_m=result["distance_m"],
        summary=f"Walk — {_fmt_dist(result['distance_m'])}",
    )


async def _compute_bike(origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> RouteOption | None:
    result = await _route("bike", origin, dest, client)
    return RouteOption(
        mode="bike",
        legs=[RouteLeg(mode="bike", **result)],
        total_distance_m=result["distance_m"],
        total_duration_s=result["duration_s"],
        walk_distance_m=0,
        summary=f"Bike — {_fmt_dist(result['distance_m'])}",
    )


async def _compute_bikeshare(origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> RouteOption | None:
    stations = get_stations()
    pickups = [(d, s) for s in stations if s["bikes"] > 0 for d in [_haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])] if d <= MAX_WALK_TO_STATION_M]
    pickups.sort(key=lambda x: x[0])
    dropoffs = [(d, s) for s in stations if s["bikes"] < s["capacity"] for d in [_haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])] if d <= MAX_WALK_TO_STATION_M]
    dropoffs.sort(key=lambda x: x[0])

    if not pickups or not dropoffs:
        return None

    best: dict[str, Any] | None = None
    best_time = float("inf")
    candidates = [(p[1], d[1]) for p in pickups[:2] for d in dropoffs[:2] if p[1]["id"] != d[1]["id"]]
    if not candidates:
        return None

    for pickup, dropoff in candidates:
        pll = LatLng(lat=pickup["lat"], lng=pickup["lng"])
        dll = LatLng(lat=dropoff["lat"], lng=dropoff["lng"])
        w1, ride, w2 = await asyncio.gather(
            _route("walk", origin, pll, client),
            _route("bike", pll, dll, client),
            _route("walk", dll, dest, client),
        )
        total = w1["duration_s"] + ride["duration_s"] + w2["duration_s"]
        if total < best_time:
            best_time = total
            best = {"walk1": w1, "ride": ride, "walk2": w2, "pickup": pickup, "dropoff": dropoff}

    if best is None:
        return None

    w1, r, w2 = best["walk1"], best["ride"], best["walk2"]
    pu, do = best["pickup"], best["dropoff"]
    return RouteOption(
        mode="bikeshare",
        legs=[RouteLeg(mode="walk", **w1), RouteLeg(mode="bike", **r), RouteLeg(mode="walk", **w2)],
        total_distance_m=w1["distance_m"] + r["distance_m"] + w2["distance_m"],
        total_duration_s=w1["duration_s"] + r["duration_s"] + w2["duration_s"],
        walk_distance_m=w1["distance_m"] + w2["distance_m"],
        summary=f"Bike Share via {pu['name']} → {do['name']}",
        pickup_station=StationRef(**pu),
        dropoff_station=StationRef(**do),
    )


# ---------------------------------------------------------------------------
# OTP-based transit routing (bus + LRT)
# ---------------------------------------------------------------------------

def _otp_leg_to_route_leg(otp_leg: _OTPLeg) -> RouteLeg:
    """Convert an OTP leg to our RouteLeg model."""
    mode = otp_mode_to_leg_mode(otp_leg.mode)

    # For transit legs, populate transit-specific fields
    if mode in ("bus", "lrt"):
        # For buses show "9" or "9 Southgate", for LRT show "Capital Line"
        if mode == "bus" and otp_leg.route_short_name:
            route_name = otp_leg.route_short_name
        elif otp_leg.route_long_name:
            route_name = otp_leg.route_long_name
        else:
            route_name = otp_leg.route_short_name or ""

        return RouteLeg(
            mode=mode,
            geometry=otp_leg.geometry,
            distance_m=otp_leg.distance_m,
            duration_s=otp_leg.duration_s,
            transit_route=route_name,
            transit_color=otp_leg.route_color,
            transit_headsign=otp_leg.headsign,
            transit_board_stop=otp_leg.from_place.name,
            transit_alight_stop=otp_leg.to_place.name,
            transit_board_time=_epoch_ms_to_hhmm(otp_leg.start_time_ms),
            transit_alight_time=_epoch_ms_to_hhmm(otp_leg.end_time_ms),
            transit_num_stops=otp_leg.num_intermediate_stops + 1,
        )
    else:
        return RouteLeg(
            mode=mode,
            geometry=otp_leg.geometry,
            distance_m=otp_leg.distance_m,
            duration_s=otp_leg.duration_s,
        )


def _otp_itinerary_to_route(it: OTPItinerary, route_mode: str) -> RouteOption:
    """Convert a full OTP itinerary to our RouteOption model."""
    legs: list[RouteLeg] = []
    transit_names: list[str] = []

    for i, otp_leg in enumerate(it.legs):
        leg = _otp_leg_to_route_leg(otp_leg)
        legs.append(leg)

        if leg.mode in ("bus", "lrt"):
            short = otp_leg.route_short_name or otp_leg.route_long_name or "Transit"
            vehicle = "🚍" if leg.mode == "bus" else "🚈"
            transit_names.append(f"{vehicle}{short}")

        # Insert a wait leg between walk→transit if there's a gap
        if (
            i > 0
            and leg.mode in ("bus", "lrt")
            and legs[-2].mode == "walk"
        ):
            prev_end = it.legs[i - 1].end_time_ms
            this_start = otp_leg.start_time_ms
            wait_s = (this_start - prev_end) / 1000
            if wait_s > 30:
                from_p = otp_leg.from_place
                wait_leg = RouteLeg(
                    mode="wait",
                    geometry={
                        "type": "LineString",
                        "coordinates": [[from_p.lng, from_p.lat], [from_p.lng, from_p.lat]],
                    },
                    distance_m=0,
                    duration_s=wait_s,
                    wait_until=_epoch_ms_to_hhmm(otp_leg.start_time_ms),
                )
                # Insert wait BEFORE the transit leg
                legs.insert(-1, wait_leg)

    transit_label = " → ".join(transit_names) if transit_names else "Transit"
    summary = f"{transit_label} — {_fmt_time(it.duration_s)}"

    return RouteOption(
        mode=route_mode,
        legs=legs,
        total_distance_m=sum(l.distance_m for l in legs),
        total_duration_s=it.duration_s,
        walk_distance_m=it.walk_distance_m,
        summary=summary,
        departure_time=_epoch_ms_to_hhmm(it.start_time_ms),
        arrival_time=_epoch_ms_to_hhmm(it.end_time_ms),
    )


async def _compute_transit_otp(
    origin: LatLng, dest: LatLng, dep_date: date, dep_s: int, client: httpx.AsyncClient,
) -> list[RouteOption]:
    """Compute walk + transit (bus/LRT) routes via OTP."""
    itineraries = await otp_plan(
        origin.lat, origin.lng, dest.lat, dest.lng,
        dep_date, dep_s,
        mode="WALK,TRANSIT",
        num_itineraries=5,
        client=client,
    )
    if not itineraries:
        return []

    routes = [_otp_itinerary_to_route(it, "transit") for it in itineraries]

    # Deduplicate by similar route structure
    seen: set[str] = set()
    unique: list[RouteOption] = []
    for r in routes:
        key = "|".join(
            f"{l.transit_route}-{l.transit_board_stop}"
            for l in r.legs if l.mode in ("bus", "lrt")
        )
        if key not in seen:
            seen.add(key)
            unique.append(r)
        if len(unique) >= 4:
            break

    return unique


async def _compute_transit_bike_otp(
    origin: LatLng, dest: LatLng, dep_date: date, dep_s: int, client: httpx.AsyncClient,
) -> list[RouteOption]:
    """
    Compose bike-share + transit routes.

    Strategy: get OTP transit itineraries, then try to replace the first/last
    walk legs with bike-share access/egress for faster door-to-door times.
    """
    stations_data = get_stations()
    results: list[RouteOption] = []

    # ── Get base transit itineraries from OTP ──
    itineraries = await otp_plan(
        origin.lat, origin.lng, dest.lat, dest.lng,
        dep_date, dep_s,
        mode="WALK,TRANSIT",
        num_itineraries=4,
        client=client,
    )

    if not itineraries:
        return []

    for it in itineraries:
        if not it.legs:
            continue

        # ── Option A: Bike-share first mile ──
        # walk→pickup BS (origin) → bike→dock BS (transit stop) → walk→transit stop → transit…
        first_leg = it.legs[0]
        if first_leg.mode == "WALK" and first_leg.distance_m > 300:
            first_transit_stop = it.legs[1].from_place if len(it.legs) > 1 else None
            if first_transit_stop:
                # Pickup BS: near origin, has available bikes
                bs_pickups = [
                    (d, s)
                    for s in stations_data if s["bikes"] > 0
                    for d in [_haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])]
                    if d <= MAX_WALK_TO_STATION_M
                ]
                bs_pickups.sort(key=lambda x: x[0])

                # Dock BS: near first transit stop, has available capacity
                bs_docks = [
                    (d, s)
                    for s in stations_data if s["bikes"] < s["capacity"]
                    for d in [_haversine_m(first_transit_stop.lat, first_transit_stop.lng, s["lat"], s["lng"])]
                    if d <= MAX_WALK_BS_TO_STOP_M
                ]
                bs_docks.sort(key=lambda x: x[0])

                for _, pickup_bs in bs_pickups[:2]:
                    for _, dock_bs in bs_docks[:1]:
                        if pickup_bs["id"] == dock_bs["id"]:
                            continue
                        try:
                            pickup_ll = LatLng(lat=pickup_bs["lat"], lng=pickup_bs["lng"])
                            dock_ll = LatLng(lat=dock_bs["lat"], lng=dock_bs["lng"])
                            stop_ll = LatLng(lat=first_transit_stop.lat, lng=first_transit_stop.lng)

                            walk_to_pickup, bike_leg, walk_dock_to_stop = await asyncio.gather(
                                _route("walk", origin, pickup_ll, client),
                                _route("bike", pickup_ll, dock_ll, client),
                                _route("walk", dock_ll, stop_ll, client),
                            )

                            new_legs: list[RouteLeg] = [
                                RouteLeg(mode="walk", **walk_to_pickup),
                                RouteLeg(mode="bike", **bike_leg),
                                RouteLeg(mode="walk", **walk_dock_to_stop),
                            ]

                            bs_first_mile_s = (
                                walk_to_pickup["duration_s"]
                                + bike_leg["duration_s"]
                                + walk_dock_to_stop["duration_s"]
                            )

                            for otp_leg in it.legs[1:]:
                                new_legs.append(_otp_leg_to_route_leg(otp_leg))

                            total_dur = it.duration_s - first_leg.duration_s + bs_first_mile_s
                            walk_dist = walk_to_pickup["distance_m"] + walk_dock_to_stop["distance_m"]
                            if it.legs[-1].mode == "WALK":
                                walk_dist += it.legs[-1].distance_m

                            transit_names = []
                            for otp_leg in it.legs[1:]:
                                mode = otp_mode_to_leg_mode(otp_leg.mode)
                                if mode in ("bus", "lrt"):
                                    short = otp_leg.route_short_name or otp_leg.route_long_name or "Transit"
                                    transit_names.append(short)

                            results.append(RouteOption(
                                mode="transit_bike",
                                legs=new_legs,
                                total_distance_m=sum(l.distance_m for l in new_legs),
                                total_duration_s=total_dur,
                                walk_distance_m=walk_dist,
                                summary=f"Bike Share + {' → '.join(transit_names) or 'Transit'}",
                                pickup_station=StationRef(**pickup_bs),
                                dropoff_station=StationRef(**dock_bs),
                                departure_time=_seconds_to_hhmm_local(dep_s),
                                arrival_time=_seconds_to_hhmm_local(int(dep_s + total_dur)),
                            ))
                        except Exception:
                            continue

        # ── Option B: Bike-share last mile ──
        # …transit→transit stop → walk→pickup BS (stop) → bike→dock BS (dest) → walk→dest
        last_leg = it.legs[-1]
        if last_leg.mode == "WALK" and last_leg.distance_m > 300:
            last_transit_stop = it.legs[-2].to_place if len(it.legs) > 1 else None
            if last_transit_stop:
                # Pickup BS: near last transit stop, has available bikes
                bs_pickups_near_stop = [
                    (d, s)
                    for s in stations_data if s["bikes"] > 0
                    for d in [_haversine_m(last_transit_stop.lat, last_transit_stop.lng, s["lat"], s["lng"])]
                    if d <= MAX_WALK_BS_TO_STOP_M
                ]
                bs_pickups_near_stop.sort(key=lambda x: x[0])

                # Dock BS: near destination, has available capacity
                bs_docks_near_dest = [
                    (d, s)
                    for s in stations_data if s["bikes"] < s["capacity"]
                    for d in [_haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])]
                    if d <= MAX_WALK_TO_STATION_M
                ]
                bs_docks_near_dest.sort(key=lambda x: x[0])

                for _, pickup_bs in bs_pickups_near_stop[:1]:
                    for _, dock_bs in bs_docks_near_dest[:2]:
                        if pickup_bs["id"] == dock_bs["id"]:
                            continue
                        try:
                            stop_ll = LatLng(lat=last_transit_stop.lat, lng=last_transit_stop.lng)
                            pickup_ll = LatLng(lat=pickup_bs["lat"], lng=pickup_bs["lng"])
                            dock_ll = LatLng(lat=dock_bs["lat"], lng=dock_bs["lng"])

                            walk_stop_to_pickup, bike_leg, walk_dock_to_dest = await asyncio.gather(
                                _route("walk", stop_ll, pickup_ll, client),
                                _route("bike", pickup_ll, dock_ll, client),
                                _route("walk", dock_ll, dest, client),
                            )

                            new_legs = [_otp_leg_to_route_leg(otp_leg) for otp_leg in it.legs[:-1]]
                            new_legs.extend([
                                RouteLeg(mode="walk", **walk_stop_to_pickup),
                                RouteLeg(mode="bike", **bike_leg),
                                RouteLeg(mode="walk", **walk_dock_to_dest),
                            ])

                            bs_last_mile_s = (
                                walk_stop_to_pickup["duration_s"]
                                + bike_leg["duration_s"]
                                + walk_dock_to_dest["duration_s"]
                            )
                            total_dur = it.duration_s - last_leg.duration_s + bs_last_mile_s

                            walk_dist = walk_stop_to_pickup["distance_m"] + walk_dock_to_dest["distance_m"]
                            if it.legs[0].mode == "WALK":
                                walk_dist += it.legs[0].distance_m

                            transit_names = []
                            for otp_leg in it.legs[:-1]:
                                mode = otp_mode_to_leg_mode(otp_leg.mode)
                                if mode in ("bus", "lrt"):
                                    short = otp_leg.route_short_name or otp_leg.route_long_name or "Transit"
                                    transit_names.append(short)

                            results.append(RouteOption(
                                mode="transit_bike",
                                legs=new_legs,
                                total_distance_m=sum(l.distance_m for l in new_legs),
                                total_duration_s=total_dur,
                                walk_distance_m=walk_dist,
                                summary=f"{' → '.join(transit_names) or 'Transit'} + Bike Share",
                                pickup_station=StationRef(**pickup_bs),
                                dropoff_station=StationRef(**dock_bs),
                                departure_time=_seconds_to_hhmm_local(dep_s),
                                arrival_time=_seconds_to_hhmm_local(int(dep_s + total_dur)),
                            ))
                        except Exception:
                            continue

    # ── Option C: Bike-share on BOTH ends ──
    # walk→pickup BS→bike→dock BS→walk→transit…transit→walk→pickup BS→bike→dock BS→walk
    for it in itineraries:
        if len(it.legs) < 3:
            continue
        first_leg = it.legs[0]
        last_leg = it.legs[-1]
        if not (first_leg.mode == "WALK" and first_leg.distance_m > 300
                and last_leg.mode == "WALK" and last_leg.distance_m > 300):
            continue

        first_transit_stop = it.legs[1].from_place if len(it.legs) > 1 else None
        last_transit_stop = it.legs[-2].to_place if len(it.legs) > 1 else None
        if not first_transit_stop or not last_transit_stop:
            continue

        # Origin side: pickup near origin, dock near first transit stop
        bs_pickups_origin = [
            (d, s)
            for s in stations_data if s["bikes"] > 0
            for d in [_haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])]
            if d <= MAX_WALK_TO_STATION_M
        ]
        bs_pickups_origin.sort(key=lambda x: x[0])

        bs_docks_first = [
            (d, s)
            for s in stations_data if s["bikes"] < s["capacity"]
            for d in [_haversine_m(first_transit_stop.lat, first_transit_stop.lng, s["lat"], s["lng"])]
            if d <= MAX_WALK_BS_TO_STOP_M
        ]
        bs_docks_first.sort(key=lambda x: x[0])

        # Dest side: pickup near last transit stop, dock near dest
        bs_pickups_last = [
            (d, s)
            for s in stations_data if s["bikes"] > 0
            for d in [_haversine_m(last_transit_stop.lat, last_transit_stop.lng, s["lat"], s["lng"])]
            if d <= MAX_WALK_BS_TO_STOP_M
        ]
        bs_pickups_last.sort(key=lambda x: x[0])

        bs_docks_dest = [
            (d, s)
            for s in stations_data if s["bikes"] < s["capacity"]
            for d in [_haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])]
            if d <= MAX_WALK_TO_STATION_M
        ]
        bs_docks_dest.sort(key=lambda x: x[0])

        for _, pu_origin in bs_pickups_origin[:1]:
            for _, dk_first in bs_docks_first[:1]:
                if pu_origin["id"] == dk_first["id"]:
                    continue
                for _, pu_last in bs_pickups_last[:1]:
                    for _, dk_dest in bs_docks_dest[:1]:
                        if pu_last["id"] == dk_dest["id"]:
                            continue
                        try:
                            po_ll = LatLng(lat=pu_origin["lat"], lng=pu_origin["lng"])
                            df_ll = LatLng(lat=dk_first["lat"], lng=dk_first["lng"])
                            fs_ll = LatLng(lat=first_transit_stop.lat, lng=first_transit_stop.lng)
                            ls_ll = LatLng(lat=last_transit_stop.lat, lng=last_transit_stop.lng)
                            pl_ll = LatLng(lat=pu_last["lat"], lng=pu_last["lng"])
                            dd_ll = LatLng(lat=dk_dest["lat"], lng=dk_dest["lng"])

                            (
                                walk_to_pu, bike_first,
                                walk_dk_to_first,
                                walk_last_to_pu, bike_last,
                                walk_dk_to_dest,
                            ) = await asyncio.gather(
                                _route("walk", origin, po_ll, client),
                                _route("bike", po_ll, df_ll, client),
                                _route("walk", df_ll, fs_ll, client),
                                _route("walk", ls_ll, pl_ll, client),
                                _route("bike", pl_ll, dd_ll, client),
                                _route("walk", dd_ll, dest, client),
                            )

                            new_legs: list[RouteLeg] = [
                                RouteLeg(mode="walk", **walk_to_pu),
                                RouteLeg(mode="bike", **bike_first),
                                RouteLeg(mode="walk", **walk_dk_to_first),
                            ]
                            for otp_leg in it.legs[1:-1]:
                                new_legs.append(_otp_leg_to_route_leg(otp_leg))
                            new_legs.extend([
                                RouteLeg(mode="walk", **walk_last_to_pu),
                                RouteLeg(mode="bike", **bike_last),
                                RouteLeg(mode="walk", **walk_dk_to_dest),
                            ])

                            bs_first_s = (
                                walk_to_pu["duration_s"]
                                + bike_first["duration_s"]
                                + walk_dk_to_first["duration_s"]
                            )
                            bs_last_s = (
                                walk_last_to_pu["duration_s"]
                                + bike_last["duration_s"]
                                + walk_dk_to_dest["duration_s"]
                            )
                            total_dur = (
                                it.duration_s
                                - first_leg.duration_s
                                - last_leg.duration_s
                                + bs_first_s + bs_last_s
                            )

                            transit_names = []
                            for otp_leg in it.legs[1:-1]:
                                mode = otp_mode_to_leg_mode(otp_leg.mode)
                                if mode in ("bus", "lrt"):
                                    short = otp_leg.route_short_name or otp_leg.route_long_name or "Transit"
                                    transit_names.append(short)

                            results.append(RouteOption(
                                mode="transit_bike",
                                legs=new_legs,
                                total_distance_m=sum(l.distance_m for l in new_legs),
                                total_duration_s=total_dur,
                                walk_distance_m=(
                                    walk_to_pu["distance_m"]
                                    + walk_dk_to_first["distance_m"]
                                    + walk_last_to_pu["distance_m"]
                                    + walk_dk_to_dest["distance_m"]
                                ),
                                summary=f"Bike Share + {' → '.join(transit_names) or 'Transit'} + Bike Share",
                                pickup_station=StationRef(**pu_origin),
                                dropoff_station=StationRef(**dk_dest),
                                departure_time=_seconds_to_hhmm_local(dep_s),
                                arrival_time=_seconds_to_hhmm_local(int(dep_s + total_dur)),
                            ))
                        except Exception:
                            continue

    # Sort by duration and deduplicate
    results.sort(key=lambda r: r.total_duration_s)
    seen: set[str] = set()
    unique: list[RouteOption] = []
    for r in results:
        key = "|".join(f"{l.mode}-{l.transit_route}" for l in r.legs if l.mode in ("bus", "lrt"))
        bs_key = f"pu={r.pickup_station.id if r.pickup_station else ''}_do={r.dropoff_station.id if r.dropoff_station else ''}"
        full_key = f"{key}|{bs_key}"
        if full_key not in seen:
            seen.add(full_key)
            unique.append(r)
        if len(unique) >= 4:
            break

    return unique


# ---------------------------------------------------------------------------
# GTFS fallback: LRT-only transit (used when OTP is not available)
# ---------------------------------------------------------------------------

def _lrt_leg_geometry(board: LRTStop, alight: LRTStop) -> dict:
    return {
        "type": "LineString",
        "coordinates": [[board.lng, board.lat], [alight.lng, alight.lat]],
    }


def _lrt_leg_from_journey(jleg: LRTJourneyLeg) -> RouteLeg:
    dist = _gtfs_haversine(jleg.board_stop.lat, jleg.board_stop.lng, jleg.alight_stop.lat, jleg.alight_stop.lng)
    dur = jleg.alight_time_s - jleg.board_time_s
    return RouteLeg(
        mode="lrt",
        geometry=_lrt_leg_geometry(jleg.board_stop, jleg.alight_stop),
        distance_m=dist,
        duration_s=max(dur, 0),
        transit_route=jleg.line_name,
        transit_color=jleg.line_color,
        transit_headsign=jleg.headsign,
        transit_board_stop=jleg.board_stop.name,
        transit_alight_stop=jleg.alight_stop.name,
        transit_board_time=_seconds_to_hhmm(jleg.board_time_s),
        transit_alight_time=_seconds_to_hhmm(jleg.alight_time_s),
        transit_num_stops=jleg.num_stops,
    )


async def _compute_transit_gtfs(
    origin: LatLng, dest: LatLng, dep_date: date, dep_s: int, client: httpx.AsyncClient,
) -> list[RouteOption]:
    """Fallback: LRT-only routing via GTFS data when OTP is not available."""
    near_origin = find_nearest_lrt_stops(origin.lat, origin.lng, MAX_WALK_TO_LRT_M, limit=4)
    near_dest = find_nearest_lrt_stops(dest.lat, dest.lng, MAX_WALK_TO_LRT_M, limit=4)

    if not near_origin or not near_dest:
        return []

    results: list[RouteOption] = []

    for board_stop, board_dist in near_origin:
        walk_to_lrt_s = board_dist / 1.4
        arrive_at_station_s = dep_s + walk_to_lrt_s

        for alight_stop, alight_dist in near_dest:
            if board_stop.stop_id == alight_stop.stop_id:
                continue

            journeys = find_lrt_journeys(
                board_stop.stop_id, alight_stop.stop_id,
                int(arrive_at_station_s), dep_date, limit=2,
            )

            for journey_legs in journeys:
                first_leg = journey_legs[0]
                last_leg = journey_legs[-1]

                board_ll = LatLng(lat=board_stop.lat, lng=board_stop.lng)
                walk_to = await _route("walk", origin, board_ll, client)

                actual_walk_dur = walk_to["duration_s"]
                arrive_s = dep_s + actual_walk_dur
                wait_s = max(0, first_leg.board_time_s - arrive_s)

                lrt_legs = [_lrt_leg_from_journey(jl) for jl in journey_legs]
                lrt_duration = last_leg.alight_time_s - first_leg.board_time_s

                alight_ll = LatLng(lat=last_leg.alight_stop.lat, lng=last_leg.alight_stop.lng)
                walk_from = await _route("walk", alight_ll, dest, client)

                legs: list[RouteLeg] = [RouteLeg(mode="walk", **walk_to)]
                if wait_s > 30:
                    legs.append(RouteLeg(
                        mode="wait",
                        geometry={"type": "LineString", "coordinates": [[board_stop.lng, board_stop.lat], [board_stop.lng, board_stop.lat]]},
                        distance_m=0,
                        duration_s=wait_s,
                        wait_until=_seconds_to_hhmm(first_leg.board_time_s),
                    ))
                legs.extend(lrt_legs)
                legs.append(RouteLeg(mode="walk", **walk_from))

                total_dur = walk_to["duration_s"] + wait_s + lrt_duration + walk_from["duration_s"]
                total_dist = walk_to["distance_m"] + walk_from["distance_m"]

                line_names = " → ".join(jl.line_name for jl in journey_legs)
                summary = f"LRT ({line_names}) — {_fmt_time(total_dur)}"

                results.append(RouteOption(
                    mode="transit",
                    legs=legs,
                    total_distance_m=total_dist,
                    total_duration_s=total_dur,
                    walk_distance_m=walk_to["distance_m"] + walk_from["distance_m"],
                    summary=summary,
                    departure_time=_seconds_to_hhmm(dep_s),
                    arrival_time=_seconds_to_hhmm(int(dep_s + total_dur)),
                ))

    results.sort(key=lambda r: r.total_duration_s)
    seen_keys: set[str] = set()
    unique: list[RouteOption] = []
    for r in results:
        key = "|".join(
            f"{l.transit_board_stop}-{l.transit_alight_stop}-{l.transit_board_time}"
            for l in r.legs if l.mode == "lrt"
        )
        if key not in seen_keys:
            seen_keys.add(key)
            unique.append(r)
        if len(unique) >= 3:
            break

    return unique


async def _compute_transit_bike_gtfs(
    origin: LatLng, dest: LatLng, dep_date: date, dep_s: int, client: httpx.AsyncClient,
) -> list[RouteOption]:
    """Fallback: bike-share + LRT-only via GTFS when OTP is not available."""
    stations_data = get_stations()
    results: list[RouteOption] = []

    # Option A: Bike Share (origin → LRT stop) → LRT → Walk
    near_dest_lrt = find_nearest_lrt_stops(dest.lat, dest.lng, MAX_WALK_TO_LRT_M, limit=3)
    if near_dest_lrt:
        bs_pickups = [
            (d, s)
            for s in stations_data if s["bikes"] > 0
            for d in [_haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])]
            if d <= MAX_BIKE_TO_LRT_M
        ]
        bs_pickups.sort(key=lambda x: x[0])

        for _, bs_station in bs_pickups[:2]:
            near_bs_lrt = find_nearest_lrt_stops(bs_station["lat"], bs_station["lng"], MAX_WALK_TO_LRT_M, limit=2)
            if not near_bs_lrt:
                continue

            for board_stop, _ in near_bs_lrt:
                # Dock BS: near LRT board stop, has capacity (different from pickup)
                bs_docks_near_board = [
                    (d, s2)
                    for s2 in stations_data if s2["bikes"] < s2["capacity"] and s2["id"] != bs_station["id"]
                    for d in [_haversine_m(board_stop.lat, board_stop.lng, s2["lat"], s2["lng"])]
                    if d <= MAX_WALK_BS_TO_STOP_M
                ]
                bs_docks_near_board.sort(key=lambda x: x[0])
                if not bs_docks_near_board:
                    continue
                dock_bs = bs_docks_near_board[0][1]

                for alight_stop, _ in near_dest_lrt:
                    if board_stop.stop_id == alight_stop.stop_id:
                        continue

                    bs_ll = LatLng(lat=bs_station["lat"], lng=bs_station["lng"])
                    dock_ll = LatLng(lat=dock_bs["lat"], lng=dock_bs["lng"])
                    board_ll = LatLng(lat=board_stop.lat, lng=board_stop.lng)
                    walk_to_bs, bike_ride, walk_dock_to_lrt = await asyncio.gather(
                        _route("walk", origin, bs_ll, client),
                        _route("bike", bs_ll, dock_ll, client),
                        _route("walk", dock_ll, board_ll, client),
                    )
                    arrive_s = dep_s + walk_to_bs["duration_s"] + bike_ride["duration_s"] + walk_dock_to_lrt["duration_s"]

                    journeys = find_lrt_journeys(board_stop.stop_id, alight_stop.stop_id, int(arrive_s), dep_date, limit=1)
                    if not journeys:
                        continue

                    journey = journeys[0]
                    first_leg = journey[0]
                    last_leg = journey[-1]

                    wait_s = max(0, first_leg.board_time_s - arrive_s)
                    lrt_legs = [_lrt_leg_from_journey(jl) for jl in journey]
                    lrt_dur = last_leg.alight_time_s - first_leg.board_time_s

                    alight_ll = LatLng(lat=last_leg.alight_stop.lat, lng=last_leg.alight_stop.lng)
                    walk_from = await _route("walk", alight_ll, dest, client)

                    legs: list[RouteLeg] = [
                        RouteLeg(mode="walk", **walk_to_bs),
                        RouteLeg(mode="bike", **bike_ride),
                        RouteLeg(mode="walk", **walk_dock_to_lrt),
                    ]
                    if wait_s > 30:
                        legs.append(RouteLeg(
                            mode="wait",
                            geometry={"type": "LineString", "coordinates": [[board_stop.lng, board_stop.lat], [board_stop.lng, board_stop.lat]]},
                            distance_m=0, duration_s=wait_s,
                            wait_until=_seconds_to_hhmm(first_leg.board_time_s),
                        ))
                    legs.extend(lrt_legs)
                    legs.append(RouteLeg(mode="walk", **walk_from))

                    total_dur = (
                        walk_to_bs["duration_s"] + bike_ride["duration_s"]
                        + walk_dock_to_lrt["duration_s"] + wait_s + lrt_dur
                        + walk_from["duration_s"]
                    )
                    line_names = " → ".join(jl.line_name for jl in journey)

                    results.append(RouteOption(
                        mode="transit_bike",
                        legs=legs,
                        total_distance_m=(
                            walk_to_bs["distance_m"] + bike_ride["distance_m"]
                            + walk_dock_to_lrt["distance_m"] + walk_from["distance_m"]
                        ),
                        total_duration_s=total_dur,
                        walk_distance_m=walk_to_bs["distance_m"] + walk_dock_to_lrt["distance_m"] + walk_from["distance_m"],
                        summary=f"Bike Share + LRT ({line_names})",
                        pickup_station=StationRef(**bs_station),
                        dropoff_station=StationRef(**dock_bs),
                        departure_time=_seconds_to_hhmm(dep_s),
                        arrival_time=_seconds_to_hhmm(int(dep_s + total_dur)),
                    ))

    # Option B: Walk → LRT → Bike Share
    near_origin_lrt = find_nearest_lrt_stops(origin.lat, origin.lng, MAX_WALK_TO_LRT_M, limit=3)
    if near_origin_lrt:
        bs_dropoffs = [
            (d, s)
            for s in stations_data if s["bikes"] < s["capacity"]
            for d in [_haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])]
            if d <= MAX_BIKE_TO_LRT_M
        ]
        bs_dropoffs.sort(key=lambda x: x[0])

        for board_stop, board_dist in near_origin_lrt[:2]:
            walk_to_s = board_dist / 1.4
            arrive_at_lrt = dep_s + walk_to_s

            for _, bs_station in bs_dropoffs[:2]:
                near_bs_lrt = find_nearest_lrt_stops(bs_station["lat"], bs_station["lng"], MAX_WALK_TO_LRT_M, limit=2)
                for alight_stop, _ in near_bs_lrt:
                    if board_stop.stop_id == alight_stop.stop_id:
                        continue

                    journeys = find_lrt_journeys(board_stop.stop_id, alight_stop.stop_id, int(arrive_at_lrt), dep_date, limit=1)
                    if not journeys:
                        continue

                    journey = journeys[0]
                    first_leg = journey[0]
                    last_leg = journey[-1]

                    # Pickup BS: near LRT alight stop, has bikes (different from dock)
                    bs_pickups_near_alight = [
                        (d, s2)
                        for s2 in stations_data if s2["bikes"] > 0 and s2["id"] != bs_station["id"]
                        for d in [_haversine_m(last_leg.alight_stop.lat, last_leg.alight_stop.lng, s2["lat"], s2["lng"])]
                        if d <= MAX_WALK_BS_TO_STOP_M
                    ]
                    bs_pickups_near_alight.sort(key=lambda x: x[0])
                    if not bs_pickups_near_alight:
                        continue
                    pickup_bs = bs_pickups_near_alight[0][1]

                    board_ll = LatLng(lat=board_stop.lat, lng=board_stop.lng)
                    walk_to = await _route("walk", origin, board_ll, client)
                    wait_s = max(0, first_leg.board_time_s - (dep_s + walk_to["duration_s"]))

                    alight_ll = LatLng(lat=last_leg.alight_stop.lat, lng=last_leg.alight_stop.lng)
                    pickup_ll = LatLng(lat=pickup_bs["lat"], lng=pickup_bs["lng"])
                    bs_ll = LatLng(lat=bs_station["lat"], lng=bs_station["lng"])
                    walk_lrt_to_pickup, bike_ride, walk_from_bs = await asyncio.gather(
                        _route("walk", alight_ll, pickup_ll, client),
                        _route("bike", pickup_ll, bs_ll, client),
                        _route("walk", bs_ll, dest, client),
                    )

                    lrt_legs = [_lrt_leg_from_journey(jl) for jl in journey]
                    lrt_dur = last_leg.alight_time_s - first_leg.board_time_s

                    legs: list[RouteLeg] = [RouteLeg(mode="walk", **walk_to)]
                    if wait_s > 30:
                        legs.append(RouteLeg(
                            mode="wait",
                            geometry={"type": "LineString", "coordinates": [[board_stop.lng, board_stop.lat], [board_stop.lng, board_stop.lat]]},
                            distance_m=0, duration_s=wait_s,
                            wait_until=_seconds_to_hhmm(first_leg.board_time_s),
                        ))
                    legs.extend(lrt_legs)
                    legs.extend([
                        RouteLeg(mode="walk", **walk_lrt_to_pickup),
                        RouteLeg(mode="bike", **bike_ride),
                        RouteLeg(mode="walk", **walk_from_bs),
                    ])

                    total_dur = (
                        walk_to["duration_s"] + wait_s + lrt_dur
                        + walk_lrt_to_pickup["duration_s"]
                        + bike_ride["duration_s"] + walk_from_bs["duration_s"]
                    )
                    line_names = " → ".join(jl.line_name for jl in journey)

                    results.append(RouteOption(
                        mode="transit_bike",
                        legs=legs,
                        total_distance_m=(
                            walk_to["distance_m"] + walk_lrt_to_pickup["distance_m"]
                            + bike_ride["distance_m"] + walk_from_bs["distance_m"]
                        ),
                        total_duration_s=total_dur,
                        walk_distance_m=(
                            walk_to["distance_m"] + walk_lrt_to_pickup["distance_m"]
                            + walk_from_bs["distance_m"]
                        ),
                        summary=f"LRT ({line_names}) + Bike Share",
                        pickup_station=StationRef(**pickup_bs),
                        dropoff_station=StationRef(**bs_station),
                        departure_time=_seconds_to_hhmm(dep_s),
                        arrival_time=_seconds_to_hhmm(int(dep_s + total_dur)),
                    ))

    results.sort(key=lambda r: r.total_duration_s)
    return results[:3]


# ---------------------------------------------------------------------------
# Elevation enrichment
# ---------------------------------------------------------------------------

async def _enrich_elevation(route: RouteOption, client: httpx.AsyncClient) -> None:
    all_coords: list[tuple[float, float]] = []
    for leg in route.legs:
        if leg.mode in ("wait",):
            continue
        for coord in leg.geometry.get("coordinates", []):
            if len(coord) >= 2:
                all_coords.append((coord[1], coord[0]))
    if len(all_coords) < 2:
        return
    try:
        profile = await compute_elevation_profile(all_coords, client, interval_m=50)
        route.elevation_profile = profile.profile
        route.total_ascent_m = profile.total_ascent_m
        route.total_descent_m = profile.total_descent_m
        route.min_elevation_m = profile.min_elevation_m
        route.max_elevation_m = profile.max_elevation_m
    except Exception:
        pass


# ---------------------------------------------------------------------------
# API endpoint
# ---------------------------------------------------------------------------

@router.post("", response_model=RoutesResponse)
async def compute_routes(req: RoutesRequest) -> RoutesResponse:
    """Compute multi-modal routes between origin and destination."""
    dep_date, dep_s = _parse_departure(req.departure_time)

    # ── Non-transit routes (walk, bike, bikeshare) ──
    async with httpx.AsyncClient() as client:
        tasks = []
        if "walk" in req.modes:
            tasks.append(_compute_walk(req.origin, req.destination, client))
        if "bike" in req.modes:
            tasks.append(_compute_bike(req.origin, req.destination, client))
        if "bikeshare" in req.modes:
            tasks.append(_compute_bikeshare(req.origin, req.destination, client))
        results = await asyncio.gather(*tasks)

    routes = [r for r in results if r is not None]

    # ── Transit routes: OTP (bus + LRT) with GTFS fallback (LRT-only) ──
    async with httpx.AsyncClient(timeout=30) as client:
        use_otp = await otp_is_available(client)

        transit_tasks: list = []
        if "transit" in req.modes:
            if use_otp:
                transit_tasks.append(_compute_transit_otp(req.origin, req.destination, dep_date, dep_s, client))
            else:
                transit_tasks.append(_compute_transit_gtfs(req.origin, req.destination, dep_date, dep_s, client))

        if "transit_bike" in req.modes:
            if use_otp:
                transit_tasks.append(_compute_transit_bike_otp(req.origin, req.destination, dep_date, dep_s, client))
            else:
                transit_tasks.append(_compute_transit_bike_gtfs(req.origin, req.destination, dep_date, dep_s, client))

        if transit_tasks:
            transit_results = await asyncio.gather(*transit_tasks, return_exceptions=True)
            for result in transit_results:
                if isinstance(result, list):
                    routes.extend(result)
                elif isinstance(result, Exception):
                    print(f"[routing] Transit computation error: {result}")

    # Collect notices
    notices: list[str] = []
    requested_transit = "transit" in req.modes or "transit_bike" in req.modes
    has_transit = any(r.mode in ("transit", "transit_bike") for r in routes)
    if requested_transit and not has_transit:
        h = dep_s // 3600
        notices.append(f"No transit service found at {h:02d}:{(dep_s % 3600) // 60:02d}. Try a different departure time.")

    # Sort: bike-share modes first (fastest first within each group)
    def _sort_key(r: RouteOption) -> tuple[int, float]:
        priority = 0 if r.mode in ("bikeshare", "transit_bike") else 1
        return (priority, r.total_duration_s)

    routes.sort(key=_sort_key)

    # Enrich routes with elevation data (in parallel, non-blocking)
    async with httpx.AsyncClient(timeout=15) as elev_client:
        elev_tasks = [_enrich_elevation(r, elev_client) for r in routes]
        await asyncio.gather(*elev_tasks, return_exceptions=True)

    return RoutesResponse(routes=routes, notices=notices)
