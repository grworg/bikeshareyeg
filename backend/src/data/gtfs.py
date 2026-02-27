"""
Rapid transit schedule from GTFS data.

Parses the GTFS feed and provides:
 - Rapid transit stop locations and metadata
 - Trip timetables per line/direction
 - Query: next departure from a stop after a given time
 - Query: journey between two stops (with transfers if needed)

The GTFS data is loaded once at import time and cached in-memory.
"""

from __future__ import annotations

import csv
import math
import os
import zipfile
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from io import TextIOWrapper
from pathlib import Path
from typing import Iterator

from src.city_loader import load_city_config

# ---------------------------------------------------------------------------
# Path to GTFS data
# ---------------------------------------------------------------------------

_city = load_city_config()
_PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
_GTFS_ZIP = _PROJECT_ROOT / _city.transit.gtfs_path
_RAPID_TRANSIT_ROUTE_TYPES = {str(rt) for rt in _city.transit.rapid_transit_route_types}
_RAPID_TRANSIT_DEFAULT_COLOR = _city.transit.rapid_transit_color.lstrip("#")

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class LRTStop:
    stop_id: str
    name: str
    lat: float
    lng: float


@dataclass
class StopTime:
    """A single stop on a trip — arrival and departure as seconds since midnight."""
    stop_id: str
    stop_seq: int
    arrival_s: int  # seconds since midnight (can be >= 86400 for next-day)
    departure_s: int


@dataclass
class LRTTrip:
    trip_id: str
    route_id: str
    service_id: str
    direction_id: str
    headsign: str
    stop_times: list[StopTime] = field(default_factory=list)


@dataclass
class LRTLine:
    route_id: str
    name: str          # e.g. "Capital Line"
    color: str         # hex color from GTFS
    # Canonical stop sequence (direction 0)
    stops_dir0: list[str] = field(default_factory=list)
    stops_dir1: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Global in-memory data (populated by load())
# ---------------------------------------------------------------------------

_stops: dict[str, LRTStop] = {}
_lines: dict[str, LRTLine] = {}  # keyed by route_id
_trips: list[LRTTrip] = []
_service_dates: dict[str, set[str]] = defaultdict(set)  # service_id -> set of "YYYYMMDD"

# Indexes built after loading
_trips_by_route_dir: dict[tuple[str, str], list[LRTTrip]] = defaultdict(list)
_stop_name_to_ids: dict[str, list[str]] = defaultdict(list)

_loaded = False


# ---------------------------------------------------------------------------
# Time parsing
# ---------------------------------------------------------------------------


def _parse_time(t: str) -> int:
    """Parse HH:MM:SS to seconds since midnight (supports >24h for overnight)."""
    parts = t.strip().split(":")
    return int(parts[0]) * 3600 + int(parts[1]) * 60 + int(parts[2])


def _seconds_to_hhmm(s: int) -> str:
    """Convert seconds-since-midnight to HH:MM (wraps at 24h)."""
    s = s % 86400
    h, m = divmod(s // 60, 60)
    return f"{h:02d}:{m:02d}"


# ---------------------------------------------------------------------------
# Haversine
# ---------------------------------------------------------------------------


def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    R = 6_371_000
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = (
        math.sin(dlat / 2) ** 2
        + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2))
        * math.sin(dlng / 2) ** 2
    )
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------


def _open_csv(zf: zipfile.ZipFile, name: str) -> csv.DictReader:
    """Open a CSV file inside the GTFS zip."""
    return csv.DictReader(TextIOWrapper(zf.open(name), encoding="utf-8-sig"))


def load() -> None:
    """Parse the GTFS zip and populate in-memory data structures."""
    global _loaded
    if _loaded:
        return

    if not _GTFS_ZIP.exists():
        print(f"[GTFS] Warning: {_GTFS_ZIP} not found — rapid transit routing disabled")
        _loaded = True
        return

    print(f"[GTFS] Loading rapid transit schedule from {_GTFS_ZIP} ...")
    print(f"[GTFS] Route types: {_RAPID_TRANSIT_ROUTE_TYPES}")

    with zipfile.ZipFile(_GTFS_ZIP) as zf:
        lrt_route_ids: set[str] = set()
        for row in _open_csv(zf, "routes.txt"):
            if row["route_type"] in _RAPID_TRANSIT_ROUTE_TYPES:
                lrt_route_ids.add(row["route_id"])
                _lines[row["route_id"]] = LRTLine(
                    route_id=row["route_id"],
                    name=row["route_long_name"] or row["route_short_name"],
                    color=row.get("route_color", _RAPID_TRANSIT_DEFAULT_COLOR),
                )

        # 2. Stops — load ALL stops (we'll filter later)
        all_stops: dict[str, LRTStop] = {}
        for row in _open_csv(zf, "stops.txt"):
            all_stops[row["stop_id"]] = LRTStop(
                stop_id=row["stop_id"],
                name=row["stop_name"],
                lat=float(row["stop_lat"]),
                lng=float(row["stop_lon"]),
            )

        # 3. Calendar dates
        for row in _open_csv(zf, "calendar_dates.txt"):
            if row["exception_type"] == "1":
                _service_dates[row["service_id"]].add(row["date"])

        # 4. Trips — only LRT
        lrt_trip_map: dict[str, LRTTrip] = {}
        for row in _open_csv(zf, "trips.txt"):
            if row["route_id"] in lrt_route_ids:
                trip = LRTTrip(
                    trip_id=row["trip_id"],
                    route_id=row["route_id"],
                    service_id=row["service_id"],
                    direction_id=row.get("direction_id", "0"),
                    headsign=row.get("trip_headsign", ""),
                )
                lrt_trip_map[row["trip_id"]] = trip

        # 5. Stop times — only LRT trips
        lrt_trip_ids = set(lrt_trip_map.keys())
        for row in _open_csv(zf, "stop_times.txt"):
            if row["trip_id"] in lrt_trip_ids:
                lrt_trip_map[row["trip_id"]].stop_times.append(
                    StopTime(
                        stop_id=row["stop_id"],
                        stop_seq=int(row["stop_sequence"]),
                        arrival_s=_parse_time(row["arrival_time"]),
                        departure_s=_parse_time(row["departure_time"]),
                    )
                )

    # Sort stop_times within each trip
    for trip in lrt_trip_map.values():
        trip.stop_times.sort(key=lambda st: st.stop_seq)

    # Collect only stops that appear in LRT trips
    lrt_stop_ids: set[str] = set()
    for trip in lrt_trip_map.values():
        for st in trip.stop_times:
            lrt_stop_ids.add(st.stop_id)

    for sid in lrt_stop_ids:
        if sid in all_stops:
            _stops[sid] = all_stops[sid]

    _trips.extend(lrt_trip_map.values())

    # Build indexes
    for trip in _trips:
        _trips_by_route_dir[(trip.route_id, trip.direction_id)].append(trip)

    # Build canonical stop sequences from a representative trip per route+dir
    for (rid, did), trips in _trips_by_route_dir.items():
        # Pick trip with most stops
        rep = max(trips, key=lambda t: len(t.stop_times))
        stop_seq = [st.stop_id for st in rep.stop_times]
        line = _lines.get(rid)
        if line:
            if did == "0":
                line.stops_dir0 = stop_seq
            else:
                line.stops_dir1 = stop_seq

    # Build stop name → stop_ids map (many stops share a name, e.g. platform variants)
    for stop in _stops.values():
        # Normalize name: strip "Stop" / "Station" suffix for matching
        base = stop.name.replace(" Stop", "").replace(" Station", "").strip()
        _stop_name_to_ids[base].append(stop.stop_id)
        _stop_name_to_ids[stop.name].append(stop.stop_id)

    print(
        f"[GTFS] Loaded: {len(_lines)} rapid transit lines, "
        f"{len(_stops)} stops, {len(_trips)} trips"
    )
    _loaded = True


# ---------------------------------------------------------------------------
# Query API
# ---------------------------------------------------------------------------


def get_lrt_stops() -> list[LRTStop]:
    """Return all LRT stops."""
    load()
    return list(_stops.values())


def get_lrt_lines() -> list[LRTLine]:
    """Return all LRT lines."""
    load()
    return list(_lines.values())


def find_nearest_lrt_stops(
    lat: float, lng: float, max_distance_m: float = 2000, limit: int = 5,
) -> list[tuple[LRTStop, float]]:
    """Find the closest LRT stops to a point, returns (stop, distance_m)."""
    load()
    results: list[tuple[LRTStop, float]] = []
    for stop in _stops.values():
        d = haversine_m(lat, lng, stop.lat, stop.lng)
        if d <= max_distance_m:
            results.append((stop, d))
    results.sort(key=lambda x: x[1])
    return results[:limit]


def _active_services(query_date: date) -> set[str]:
    """Return service_ids active on a given date."""
    date_str = query_date.strftime("%Y%m%d")
    active = set()
    for sid, dates in _service_dates.items():
        if date_str in dates:
            active.add(sid)
    return active


def _stop_ids_at_station(stop_id: str) -> set[str]:
    """
    Given one stop_id, find all stop_ids that represent the same station.
    (Different platforms for different directions share the same base name.)
    """
    if stop_id not in _stops:
        return {stop_id}
    base = _stops[stop_id].name.replace(" Stop", "").replace(" Station", "").strip()
    return set(_stop_name_to_ids.get(base, [stop_id]))


def next_departures(
    stop_id: str,
    after_s: int,
    query_date: date,
    route_id: str | None = None,
    direction_id: str | None = None,
    limit: int = 3,
) -> list[dict]:
    """
    Find the next departures from a stop (or its platform variants) after a
    given time (seconds since midnight).

    Returns list of dicts:
      { trip_id, route_id, direction_id, headsign, departure_s, departure_hhmm }
    """
    load()
    active = _active_services(query_date)
    stop_ids = _stop_ids_at_station(stop_id)

    candidates: list[dict] = []
    for trip in _trips:
        if trip.service_id not in active:
            continue
        if route_id and trip.route_id != route_id:
            continue
        if direction_id and trip.direction_id != direction_id:
            continue

        for st in trip.stop_times:
            if st.stop_id in stop_ids and st.departure_s >= after_s:
                candidates.append({
                    "trip_id": trip.trip_id,
                    "route_id": trip.route_id,
                    "direction_id": trip.direction_id,
                    "headsign": trip.headsign,
                    "departure_s": st.departure_s,
                    "departure_hhmm": _seconds_to_hhmm(st.departure_s),
                })
                break  # only one stop_time per trip matters

    candidates.sort(key=lambda c: c["departure_s"])
    return candidates[:limit]


@dataclass
class LRTJourneyLeg:
    """One leg of an LRT journey (single line, no transfer)."""
    route_id: str
    line_name: str
    line_color: str
    direction_id: str
    headsign: str
    board_stop: LRTStop
    alight_stop: LRTStop
    board_time_s: int     # seconds since midnight
    alight_time_s: int
    num_stops: int
    intermediate_stops: list[str]  # stop names between board and alight


def find_lrt_journeys(
    board_stop_id: str,
    alight_stop_id: str,
    after_s: int,
    query_date: date,
    limit: int = 3,
) -> list[list[LRTJourneyLeg]]:
    """
    Find LRT journeys from board_stop to alight_stop.
    Returns a list of journeys, each being a list of LRTJourneyLeg.

    Handles:
    - Direct (same line) journeys
    - One-transfer journeys (via shared stations like Churchill)
    """
    load()
    active = _active_services(query_date)
    board_ids = _stop_ids_at_station(board_stop_id)
    alight_ids = _stop_ids_at_station(alight_stop_id)

    # Try direct journeys first
    directs = _find_direct_journeys(board_ids, alight_ids, after_s, active, limit)
    if directs:
        return [[leg] for leg in directs]

    # Try one-transfer journeys via common stations (Churchill, etc.)
    return _find_transfer_journeys(board_ids, alight_ids, after_s, active, limit)


def _find_direct_journeys(
    board_ids: set[str],
    alight_ids: set[str],
    after_s: int,
    active_services: set[str],
    limit: int,
) -> list[LRTJourneyLeg]:
    """Find direct (no transfer) journeys."""
    results: list[LRTJourneyLeg] = []

    for trip in _trips:
        if trip.service_id not in active_services:
            continue

        # Find board and alight indices in this trip's stop sequence
        board_idx: int | None = None
        alight_idx: int | None = None

        for i, st in enumerate(trip.stop_times):
            if st.stop_id in board_ids and board_idx is None:
                if st.departure_s >= after_s:
                    board_idx = i
            if st.stop_id in alight_ids and board_idx is not None:
                alight_idx = i
                break  # found both

        if board_idx is not None and alight_idx is not None and alight_idx > board_idx:
            board_st = trip.stop_times[board_idx]
            alight_st = trip.stop_times[alight_idx]
            line = _lines.get(trip.route_id)

            intermediate = []
            for k in range(board_idx + 1, alight_idx):
                sid = trip.stop_times[k].stop_id
                intermediate.append(_stops[sid].name if sid in _stops else sid)

            results.append(LRTJourneyLeg(
                route_id=trip.route_id,
                line_name=line.name if line else trip.route_id,
                line_color=line.color if line else "7b1fa2",
                direction_id=trip.direction_id,
                headsign=trip.headsign,
                board_stop=_stops.get(board_st.stop_id, LRTStop(board_st.stop_id, board_st.stop_id, 0, 0)),
                alight_stop=_stops.get(alight_st.stop_id, LRTStop(alight_st.stop_id, alight_st.stop_id, 0, 0)),
                board_time_s=board_st.departure_s,
                alight_time_s=alight_st.arrival_s,
                num_stops=alight_idx - board_idx,
                intermediate_stops=intermediate,
            ))

    results.sort(key=lambda r: r.board_time_s)
    return results[:limit]


def _find_transfer_journeys(
    board_ids: set[str],
    alight_ids: set[str],
    after_s: int,
    active_services: set[str],
    limit: int,
) -> list[list[LRTJourneyLeg]]:
    """Find journeys with one transfer at a shared station."""
    # Find stations served by multiple lines (transfer points)
    stop_to_routes: dict[str, set[str]] = defaultdict(set)
    for trip in _trips:
        for st in trip.stop_times:
            base = _stops[st.stop_id].name.replace(" Stop", "").replace(" Station", "").strip() if st.stop_id in _stops else st.stop_id
            stop_to_routes[base].add(trip.route_id)

    transfer_stations = {name for name, routes in stop_to_routes.items() if len(routes) >= 2}

    results: list[list[LRTJourneyLeg]] = []

    for xfer_name in transfer_stations:
        xfer_ids = set(_stop_name_to_ids.get(xfer_name, []))
        if not xfer_ids:
            continue

        # First leg: board → transfer station
        first_legs = _find_direct_journeys(board_ids, xfer_ids, after_s, active_services, limit=3)
        for first in first_legs:
            # Second leg: transfer station → alight (allow 2-min transfer)
            transfer_after = first.alight_time_s + 120  # 2 min transfer time
            second_legs = _find_direct_journeys(xfer_ids, alight_ids, transfer_after, active_services, limit=2)
            for second in second_legs:
                # Don't suggest same-line transfers (that's just a direct ride)
                if second.route_id != first.route_id:
                    results.append([first, second])

    results.sort(key=lambda j: j[-1].alight_time_s)
    return results[:limit]


# ---------------------------------------------------------------------------
# Auto-load on import
# ---------------------------------------------------------------------------

load()
