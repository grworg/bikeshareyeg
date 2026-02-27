"""Transit routing: OTP-based (bus + rapid transit) and GTFS fallback."""

from __future__ import annotations

import asyncio
from datetime import date

import httpx

from src.data.otp import (
    plan as otp_plan,
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
from src.api.routing.models import LatLng, RouteLeg, RouteOption, StationRef
from src.api.routing.helpers import (
    haversine_m,
    fmt_time,
    epoch_ms_to_hhmm,
    seconds_to_hhmm_local,
)
from src.api.routing.engines import route
from src.config import city

_RT_LABEL = city.transit.rapid_transit_label

MAX_WALK_TO_STATION_M = 1500
MAX_WALK_TO_RT_M = 2000
MAX_BIKE_TO_RT_M = 3000
MAX_WALK_BS_TO_STOP_M = 800


# ---------------------------------------------------------------------------
# OTP leg/itinerary conversion
# ---------------------------------------------------------------------------

def _otp_leg_to_route_leg(otp_leg: _OTPLeg) -> RouteLeg:
    """Convert an OTP leg to our RouteLeg model."""
    mode = otp_mode_to_leg_mode(otp_leg.mode)

    if mode in ("bus", "lrt"):
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
            transit_board_time=epoch_ms_to_hhmm(otp_leg.start_time_ms),
            transit_alight_time=epoch_ms_to_hhmm(otp_leg.end_time_ms),
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
                    wait_until=epoch_ms_to_hhmm(otp_leg.start_time_ms),
                )
                legs.insert(-1, wait_leg)

    transit_label = " → ".join(transit_names) if transit_names else "Transit"
    summary = f"{transit_label} — {fmt_time(it.duration_s)}"

    return RouteOption(
        mode=route_mode,
        legs=legs,
        total_distance_m=sum(l.distance_m for l in legs),
        total_duration_s=it.duration_s,
        walk_distance_m=it.walk_distance_m,
        summary=summary,
        departure_time=epoch_ms_to_hhmm(it.start_time_ms),
        arrival_time=epoch_ms_to_hhmm(it.end_time_ms),
    )


# ---------------------------------------------------------------------------
# OTP: walk + transit (bus + LRT)
# ---------------------------------------------------------------------------

async def compute_transit_otp(
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


# ---------------------------------------------------------------------------
# OTP: transit + bikeshare combos
# ---------------------------------------------------------------------------

async def compute_transit_bike_otp(
    origin: LatLng, dest: LatLng, dep_date: date, dep_s: int, client: httpx.AsyncClient,
    stations_data: list[dict] | None = None,
) -> list[RouteOption]:
    """
    Compose bike-share + transit routes.

    Strategy: get OTP transit itineraries, then try to replace the first/last
    walk legs with bike-share access/egress for faster door-to-door times.
    """
    if not stations_data:
        stations_data = []
    print(f"[transit_bike] {len(stations_data)} stations provided")
    results: list[RouteOption] = []

    # Two queries: normal + transit-preferring (high walkReluctance forces OTP
    # to suggest transit even for short trips where walking might be faster).
    normal_its, transit_pref_its = await asyncio.gather(
        otp_plan(
            origin.lat, origin.lng, dest.lat, dest.lng,
            dep_date, dep_s,
            mode="WALK,TRANSIT",
            num_itineraries=4,
            client=client,
        ),
        otp_plan(
            origin.lat, origin.lng, dest.lat, dest.lng,
            dep_date, dep_s,
            mode="WALK,TRANSIT",
            num_itineraries=3,
            walk_reluctance=6.0,
            client=client,
        ),
    )

    seen_keys: set[str] = set()
    itineraries: list[OTPItinerary] = []
    for it in [*normal_its, *transit_pref_its]:
        key = "|".join(f"{l.mode}-{l.from_place.name}" for l in it.legs if l.mode != "WALK")
        if key and key not in seen_keys:
            seen_keys.add(key)
            itineraries.append(it)

    if not itineraries:
        return []

    for it in itineraries:
        if not it.legs:
            continue

        # ── Option A: Bike-share first mile ──
        first_leg = it.legs[0]
        if first_leg.mode == "WALK" and first_leg.distance_m > 100:
            first_transit_stop = it.legs[1].from_place if len(it.legs) > 1 else None
            if first_transit_stop:
                bs_pickups = [
                    (d, s)
                    for s in stations_data if s["bikes"] > 0
                    for d in [haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])]
                    if d <= MAX_WALK_TO_STATION_M
                ]
                bs_pickups.sort(key=lambda x: x[0])

                bs_docks = [
                    (d, s)
                    for s in stations_data if s["bikes"] < s["capacity"]
                    for d in [haversine_m(first_transit_stop.lat, first_transit_stop.lng, s["lat"], s["lng"])]
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
                                route("walk", origin, pickup_ll, client),
                                route("bike", pickup_ll, dock_ll, client),
                                route("walk", dock_ll, stop_ll, client),
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
                                m = otp_mode_to_leg_mode(otp_leg.mode)
                                if m in ("bus", "lrt"):
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
                                departure_time=seconds_to_hhmm_local(dep_s),
                                arrival_time=seconds_to_hhmm_local(int(dep_s + total_dur)),
                            ))
                        except Exception:
                            continue

        # ── Option B: Bike-share last mile ──
        last_leg = it.legs[-1]
        if last_leg.mode == "WALK" and last_leg.distance_m > 100:
            last_transit_stop = it.legs[-2].to_place if len(it.legs) > 1 else None
            if last_transit_stop:
                bs_pickups_near_stop = [
                    (d, s)
                    for s in stations_data if s["bikes"] > 0
                    for d in [haversine_m(last_transit_stop.lat, last_transit_stop.lng, s["lat"], s["lng"])]
                    if d <= MAX_WALK_BS_TO_STOP_M
                ]
                bs_pickups_near_stop.sort(key=lambda x: x[0])

                bs_docks_near_dest = [
                    (d, s)
                    for s in stations_data if s["bikes"] < s["capacity"]
                    for d in [haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])]
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
                                route("walk", stop_ll, pickup_ll, client),
                                route("bike", pickup_ll, dock_ll, client),
                                route("walk", dock_ll, dest, client),
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
                                m = otp_mode_to_leg_mode(otp_leg.mode)
                                if m in ("bus", "lrt"):
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
                                departure_time=seconds_to_hhmm_local(dep_s),
                                arrival_time=seconds_to_hhmm_local(int(dep_s + total_dur)),
                            ))
                        except Exception:
                            continue

    # ── Option C: Bike-share on BOTH ends ──
    for it in itineraries:
        if len(it.legs) < 3:
            continue
        first_leg = it.legs[0]
        last_leg = it.legs[-1]
        if not (first_leg.mode == "WALK" and first_leg.distance_m > 100
                and last_leg.mode == "WALK" and last_leg.distance_m > 100):
            continue

        first_transit_stop = it.legs[1].from_place if len(it.legs) > 1 else None
        last_transit_stop = it.legs[-2].to_place if len(it.legs) > 1 else None
        if not first_transit_stop or not last_transit_stop:
            continue

        bs_pickups_origin = [
            (d, s)
            for s in stations_data if s["bikes"] > 0
            for d in [haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])]
            if d <= MAX_WALK_TO_STATION_M
        ]
        bs_pickups_origin.sort(key=lambda x: x[0])

        bs_docks_first = [
            (d, s)
            for s in stations_data if s["bikes"] < s["capacity"]
            for d in [haversine_m(first_transit_stop.lat, first_transit_stop.lng, s["lat"], s["lng"])]
            if d <= MAX_WALK_BS_TO_STOP_M
        ]
        bs_docks_first.sort(key=lambda x: x[0])

        bs_pickups_last = [
            (d, s)
            for s in stations_data if s["bikes"] > 0
            for d in [haversine_m(last_transit_stop.lat, last_transit_stop.lng, s["lat"], s["lng"])]
            if d <= MAX_WALK_BS_TO_STOP_M
        ]
        bs_pickups_last.sort(key=lambda x: x[0])

        bs_docks_dest = [
            (d, s)
            for s in stations_data if s["bikes"] < s["capacity"]
            for d in [haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])]
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
                                route("walk", origin, po_ll, client),
                                route("bike", po_ll, df_ll, client),
                                route("walk", df_ll, fs_ll, client),
                                route("walk", ls_ll, pl_ll, client),
                                route("bike", pl_ll, dd_ll, client),
                                route("walk", dd_ll, dest, client),
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
                                m = otp_mode_to_leg_mode(otp_leg.mode)
                                if m in ("bus", "lrt"):
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
                                departure_time=seconds_to_hhmm_local(dep_s),
                                arrival_time=seconds_to_hhmm_local(int(dep_s + total_dur)),
                            ))
                        except Exception:
                            continue

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


async def compute_transit_gtfs(
    origin: LatLng, dest: LatLng, dep_date: date, dep_s: int, client: httpx.AsyncClient,
) -> list[RouteOption]:
    """Fallback: LRT-only routing via GTFS data when OTP is not available."""
    near_origin = find_nearest_lrt_stops(origin.lat, origin.lng, MAX_WALK_TO_RT_M, limit=4)
    near_dest = find_nearest_lrt_stops(dest.lat, dest.lng, MAX_WALK_TO_RT_M, limit=4)

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
                walk_to = await route("walk", origin, board_ll, client)

                actual_walk_dur = walk_to["duration_s"]
                arrive_s = dep_s + actual_walk_dur
                wait_s = max(0, first_leg.board_time_s - arrive_s)

                lrt_legs = [_lrt_leg_from_journey(jl) for jl in journey_legs]
                lrt_duration = last_leg.alight_time_s - first_leg.board_time_s

                alight_ll = LatLng(lat=last_leg.alight_stop.lat, lng=last_leg.alight_stop.lng)
                walk_from = await route("walk", alight_ll, dest, client)

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
                summary = f"{_RT_LABEL} ({line_names}) — {fmt_time(total_dur)}"

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


async def compute_transit_bike_gtfs(
    origin: LatLng, dest: LatLng, dep_date: date, dep_s: int, client: httpx.AsyncClient,
    stations_data: list[dict] | None = None,
) -> list[RouteOption]:
    """Fallback: bike-share + LRT-only via GTFS when OTP is not available."""
    if not stations_data:
        stations_data = []
    results: list[RouteOption] = []

    # Option A: Bike Share (origin → LRT stop) → LRT → Walk
    near_dest_lrt = find_nearest_lrt_stops(dest.lat, dest.lng, MAX_WALK_TO_RT_M, limit=3)
    if near_dest_lrt:
        bs_pickups = [
            (d, s)
            for s in stations_data if s["bikes"] > 0
            for d in [haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])]
            if d <= MAX_BIKE_TO_RT_M
        ]
        bs_pickups.sort(key=lambda x: x[0])

        for _, bs_station in bs_pickups[:2]:
            near_bs_lrt = find_nearest_lrt_stops(bs_station["lat"], bs_station["lng"], MAX_WALK_TO_RT_M, limit=2)
            if not near_bs_lrt:
                continue

            for board_stop, _ in near_bs_lrt:
                bs_docks_near_board = [
                    (d, s2)
                    for s2 in stations_data if s2["bikes"] < s2["capacity"] and s2["id"] != bs_station["id"]
                    for d in [haversine_m(board_stop.lat, board_stop.lng, s2["lat"], s2["lng"])]
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
                        route("walk", origin, bs_ll, client),
                        route("bike", bs_ll, dock_ll, client),
                        route("walk", dock_ll, board_ll, client),
                    )
                    arrive_s = dep_s + walk_to_bs["duration_s"] + bike_ride["duration_s"] + walk_dock_to_lrt["duration_s"]

                    journeys = find_lrt_journeys(board_stop.stop_id, alight_stop.stop_id, int(arrive_s), dep_date, limit=1)
                    if not journeys:
                        continue

                    journey = journeys[0]
                    first_jleg = journey[0]
                    last_jleg = journey[-1]

                    wait_s = max(0, first_jleg.board_time_s - arrive_s)
                    lrt_legs = [_lrt_leg_from_journey(jl) for jl in journey]
                    lrt_dur = last_jleg.alight_time_s - first_jleg.board_time_s

                    alight_ll = LatLng(lat=last_jleg.alight_stop.lat, lng=last_jleg.alight_stop.lng)
                    walk_from = await route("walk", alight_ll, dest, client)

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
                            wait_until=_seconds_to_hhmm(first_jleg.board_time_s),
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
                        summary=f"Bike Share + {_RT_LABEL} ({line_names})",
                        pickup_station=StationRef(**bs_station),
                        dropoff_station=StationRef(**dock_bs),
                        departure_time=_seconds_to_hhmm(dep_s),
                        arrival_time=_seconds_to_hhmm(int(dep_s + total_dur)),
                    ))

    # Option B: Walk → LRT → Bike Share
    near_origin_lrt = find_nearest_lrt_stops(origin.lat, origin.lng, MAX_WALK_TO_RT_M, limit=3)
    if near_origin_lrt:
        bs_dropoffs = [
            (d, s)
            for s in stations_data if s["bikes"] < s["capacity"]
            for d in [haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])]
            if d <= MAX_BIKE_TO_RT_M
        ]
        bs_dropoffs.sort(key=lambda x: x[0])

        for board_stop, board_dist in near_origin_lrt[:2]:
            walk_to_s = board_dist / 1.4
            arrive_at_lrt = dep_s + walk_to_s

            for _, bs_station in bs_dropoffs[:2]:
                near_bs_lrt = find_nearest_lrt_stops(bs_station["lat"], bs_station["lng"], MAX_WALK_TO_RT_M, limit=2)
                for alight_stop, _ in near_bs_lrt:
                    if board_stop.stop_id == alight_stop.stop_id:
                        continue

                    journeys = find_lrt_journeys(board_stop.stop_id, alight_stop.stop_id, int(arrive_at_lrt), dep_date, limit=1)
                    if not journeys:
                        continue

                    journey = journeys[0]
                    first_jleg = journey[0]
                    last_jleg = journey[-1]

                    bs_pickups_near_alight = [
                        (d, s2)
                        for s2 in stations_data if s2["bikes"] > 0 and s2["id"] != bs_station["id"]
                        for d in [haversine_m(last_jleg.alight_stop.lat, last_jleg.alight_stop.lng, s2["lat"], s2["lng"])]
                        if d <= MAX_WALK_BS_TO_STOP_M
                    ]
                    bs_pickups_near_alight.sort(key=lambda x: x[0])
                    if not bs_pickups_near_alight:
                        continue
                    pickup_bs = bs_pickups_near_alight[0][1]

                    board_ll = LatLng(lat=board_stop.lat, lng=board_stop.lng)
                    walk_to = await route("walk", origin, board_ll, client)
                    wait_s = max(0, first_jleg.board_time_s - (dep_s + walk_to["duration_s"]))

                    alight_ll = LatLng(lat=last_jleg.alight_stop.lat, lng=last_jleg.alight_stop.lng)
                    pickup_ll = LatLng(lat=pickup_bs["lat"], lng=pickup_bs["lng"])
                    bs_ll = LatLng(lat=bs_station["lat"], lng=bs_station["lng"])
                    walk_lrt_to_pickup, bike_ride, walk_from_bs = await asyncio.gather(
                        route("walk", alight_ll, pickup_ll, client),
                        route("bike", pickup_ll, bs_ll, client),
                        route("walk", bs_ll, dest, client),
                    )

                    lrt_legs = [_lrt_leg_from_journey(jl) for jl in journey]
                    lrt_dur = last_jleg.alight_time_s - first_jleg.board_time_s

                    legs: list[RouteLeg] = [RouteLeg(mode="walk", **walk_to)]
                    if wait_s > 30:
                        legs.append(RouteLeg(
                            mode="wait",
                            geometry={"type": "LineString", "coordinates": [[board_stop.lng, board_stop.lat], [board_stop.lng, board_stop.lat]]},
                            distance_m=0, duration_s=wait_s,
                            wait_until=_seconds_to_hhmm(first_jleg.board_time_s),
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
                        summary=f"{_RT_LABEL} ({line_names}) + Bike Share",
                        pickup_station=StationRef(**pickup_bs),
                        dropoff_station=StationRef(**bs_station),
                        departure_time=_seconds_to_hhmm(dep_s),
                        arrival_time=_seconds_to_hhmm(int(dep_s + total_dur)),
                    ))

    results.sort(key=lambda r: r.total_duration_s)
    return results[:3]
