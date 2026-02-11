"""
OpenTripPlanner 2 client.

Provides an async interface to OTP's GraphQL trip-planning API.
OTP handles multi-modal routing across the Edmonton transit network
(LRT + bus + walking) using GTFS schedules and OSM street data.

Falls back gracefully when OTP is not running.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from datetime import date

import httpx

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

OTP_BASE = os.environ.get("OTP_URL", "http://localhost:8080")
OTP_GRAPHQL = f"{OTP_BASE}/otp/routers/default/index/graphql"

_otp_available: bool | None = None  # cached health state


# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------

@dataclass
class OTPPlace:
    name: str
    lat: float
    lng: float
    stop_id: str | None = None


@dataclass
class OTPLeg:
    mode: str               # WALK, BUS, TRAM, RAIL, SUBWAY, CABLE_CAR …
    from_place: OTPPlace
    to_place: OTPPlace
    distance_m: float
    duration_s: float
    start_time_ms: int      # epoch milliseconds
    end_time_ms: int
    geometry: dict           # GeoJSON LineString (decoded)
    route_short_name: str | None = None   # "9", "Capital"
    route_long_name: str | None = None
    route_color: str | None = None        # hex without #
    headsign: str | None = None
    num_intermediate_stops: int = 0
    intermediate_stops: list[str] = field(default_factory=list)


@dataclass
class OTPItinerary:
    duration_s: float
    start_time_ms: int
    end_time_ms: int
    walk_distance_m: float
    transfers: int
    legs: list[OTPLeg]


# ---------------------------------------------------------------------------
# Google Encoded Polyline decoder
# ---------------------------------------------------------------------------

def _decode_polyline(encoded: str) -> list[list[float]]:
    """Decode Google Encoded Polyline → [[lng, lat], …] for GeoJSON."""
    coords: list[list[float]] = []
    i = 0
    lat = 0
    lng = 0
    while i < len(encoded):
        # Latitude
        shift = result = 0
        while True:
            b = ord(encoded[i]) - 63
            i += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lat += ~(result >> 1) if (result & 1) else (result >> 1)

        # Longitude
        shift = result = 0
        while True:
            b = ord(encoded[i]) - 63
            i += 1
            result |= (b & 0x1F) << shift
            shift += 5
            if b < 0x20:
                break
        lng += ~(result >> 1) if (result & 1) else (result >> 1)

        coords.append([lng / 1e5, lat / 1e5])

    return coords


# ---------------------------------------------------------------------------
# GraphQL query template
# ---------------------------------------------------------------------------

PLAN_QUERY = """
query Plan(
  $fromLat: Float!,
  $fromLon: Float!,
  $toLat: Float!,
  $toLon: Float!,
  $date: String!,
  $time: String!,
  $numItineraries: Int!,
  $transportModes: [TransportMode!]
) {
  plan(
    from: { lat: $fromLat, lon: $fromLon }
    to: { lat: $toLat, lon: $toLon }
    date: $date
    time: $time
    numItineraries: $numItineraries
    transportModes: $transportModes
  ) {
    itineraries {
      duration
      startTime
      endTime
      walkDistance
      legs {
        mode
        duration
        distance
        startTime
        endTime
        from {
          name
          lat
          lon
          stop { gtfsId name }
        }
        to {
          name
          lat
          lon
          stop { gtfsId name }
        }
        route {
          shortName
          longName
          color
        }
        headsign
        legGeometry {
          points
          length
        }
        intermediateStops {
          name
        }
      }
    }
  }
}
"""


# ---------------------------------------------------------------------------
# Health check
# ---------------------------------------------------------------------------

async def is_available(client: httpx.AsyncClient | None = None) -> bool:
    """Check whether OTP is reachable.  Caches result for the process lifetime."""
    global _otp_available
    if _otp_available is not None:
        return _otp_available

    own_client = client is None
    try:
        c = client or httpx.AsyncClient(timeout=5)
        # Simple introspection query to verify GraphQL is up
        resp = await c.post(
            OTP_GRAPHQL,
            json={"query": "{ __typename }"},
            headers={"Content-Type": "application/json"},
            timeout=5,
        )
        _otp_available = resp.status_code == 200
    except Exception:
        _otp_available = False
    finally:
        if own_client and 'c' in dir():
            await c.aclose()

    if _otp_available:
        print("[OTP] OpenTripPlanner is available — using OTP for transit routing")
    else:
        print("[OTP] OpenTripPlanner not available — falling back to GTFS LRT-only routing")

    return _otp_available


def reset_availability() -> None:
    """Force re-check on next call (useful for testing)."""
    global _otp_available
    _otp_available = None


# ---------------------------------------------------------------------------
# Parse OTP GraphQL response
# ---------------------------------------------------------------------------

def _parse_place(raw: dict) -> OTPPlace:
    stop = raw.get("stop") or {}
    return OTPPlace(
        name=raw.get("name", ""),
        lat=raw.get("lat", 0),
        lng=raw.get("lon", 0),
        stop_id=stop.get("gtfsId"),
    )


def _parse_leg(raw: dict) -> OTPLeg:
    # Decode polyline geometry
    geom = raw.get("legGeometry") or {}
    encoded = geom.get("points", "")
    coords = _decode_polyline(encoded) if encoded else []
    geometry = {"type": "LineString", "coordinates": coords} if coords else {
        "type": "LineString",
        "coordinates": [
            [raw["from"]["lon"], raw["from"]["lat"]],
            [raw["to"]["lon"], raw["to"]["lat"]],
        ],
    }

    # Intermediate stop names
    intermediate = [
        s.get("name", "") for s in (raw.get("intermediateStops") or [])
    ]

    # Route info (only for transit legs)
    route = raw.get("route") or {}
    color = route.get("color")
    if color and color.startswith("#"):
        color = color[1:]

    return OTPLeg(
        mode=raw.get("mode", "WALK"),
        from_place=_parse_place(raw.get("from", {})),
        to_place=_parse_place(raw.get("to", {})),
        distance_m=raw.get("distance", 0),
        duration_s=raw.get("duration", 0),
        start_time_ms=raw.get("startTime", 0),
        end_time_ms=raw.get("endTime", 0),
        geometry=geometry,
        route_short_name=route.get("shortName"),
        route_long_name=route.get("longName"),
        route_color=color,
        headsign=raw.get("headsign"),
        num_intermediate_stops=len(intermediate),
        intermediate_stops=intermediate,
    )


def _parse_itinerary(raw: dict) -> OTPItinerary:
    legs = [_parse_leg(leg) for leg in (raw.get("legs") or [])]
    transfers = sum(1 for l in legs if l.mode not in ("WALK", "BICYCLE")) - 1
    return OTPItinerary(
        duration_s=raw.get("duration", 0),
        start_time_ms=raw.get("startTime", 0),
        end_time_ms=raw.get("endTime", 0),
        walk_distance_m=raw.get("walkDistance", 0),
        transfers=max(0, transfers),
        legs=legs,
    )


# ---------------------------------------------------------------------------
# Plan query
# ---------------------------------------------------------------------------

def _build_transport_modes(mode_str: str) -> list[dict]:
    """Convert a mode string like 'WALK,TRANSIT' to OTP2 GraphQL transportModes."""
    modes = []
    for m in mode_str.split(","):
        m = m.strip()
        if m == "TRANSIT":
            modes.append({"mode": "TRANSIT"})
        elif m == "WALK":
            modes.append({"mode": "WALK"})
        elif m == "BICYCLE":
            modes.append({"mode": "BICYCLE"})
        elif m == "BUS":
            modes.append({"mode": "BUS"})
        elif m == "RAIL":
            modes.append({"mode": "RAIL"})
        elif m == "TRAM":
            modes.append({"mode": "TRAM"})
    return modes


async def plan(
    from_lat: float,
    from_lng: float,
    to_lat: float,
    to_lng: float,
    query_date: date,
    time_s: int,             # seconds since midnight
    mode: str = "WALK,TRANSIT",
    num_itineraries: int = 5,
    max_walk_distance: int = 2000,
    client: httpx.AsyncClient | None = None,
) -> list[OTPItinerary]:
    """
    Query OTP for transit itineraries via GraphQL.

    Returns an empty list if OTP is not available or no routes are found.
    """
    if not await is_available(client):
        return []

    h = time_s // 3600
    m = (time_s % 3600) // 60
    time_str = f"{h:02d}:{m:02d}"
    date_str = query_date.strftime("%Y-%m-%d")

    variables = {
        "fromLat": from_lat,
        "fromLon": from_lng,
        "toLat": to_lat,
        "toLon": to_lng,
        "date": date_str,
        "time": time_str,
        "numItineraries": num_itineraries,
        "transportModes": _build_transport_modes(mode),
    }

    own_client = client is None
    try:
        c = client or httpx.AsyncClient(timeout=30)
        resp = await c.post(
            OTP_GRAPHQL,
            json={"query": PLAN_QUERY, "variables": variables},
            headers={"Content-Type": "application/json"},
            timeout=30,
        )

        if resp.status_code != 200:
            print(f"[OTP] GraphQL query returned {resp.status_code}")
            return []

        data = resp.json()

        # Check for GraphQL errors
        if "errors" in data:
            print(f"[OTP] GraphQL errors: {data['errors']}")
            return []

        plan_data = (data.get("data") or {}).get("plan") or {}
        raw_itineraries = plan_data.get("itineraries") or []

        return [_parse_itinerary(it) for it in raw_itineraries]

    except Exception as exc:
        print(f"[OTP] Plan query failed: {exc}")
        return []
    finally:
        if own_client and 'c' in dir():
            await c.aclose()


# ---------------------------------------------------------------------------
# Utility: OTP mode string → our leg mode string
# ---------------------------------------------------------------------------

OTP_MODE_MAP = {
    "WALK": "walk",
    "BICYCLE": "bike",
    "BUS": "bus",
    "TRAM": "lrt",
    "RAIL": "lrt",
    "SUBWAY": "lrt",
    "CABLE_CAR": "lrt",
    "FERRY": "bus",     # map ferry to bus for display
}


def otp_mode_to_leg_mode(otp_mode: str) -> str:
    """Convert OTP transit mode string to our RouteLeg mode."""
    return OTP_MODE_MAP.get(otp_mode, "bus")
