"""FastAPI endpoint for multi-modal route computation."""

from __future__ import annotations

import asyncio

import httpx
from fastapi import APIRouter, Request

from src.data.stations import get_stations
from src.data.otp import is_available as otp_is_available
from src.api.routing.models import RoutesRequest, RoutesResponse
from src.api.routing.helpers import parse_departure
from src.api.routing.engines import EXTERNAL_TIMEOUT
from src.api.routing.walk_bike import compute_walk, compute_bike, compute_bikeshare
from src.api.routing.transit import (
    compute_transit_otp,
    compute_transit_bike_otp,
    compute_transit_gtfs,
    compute_transit_bike_gtfs,
)
from src.api.routing.enrich import enrich_elevation
from src.api.routing.instructions import enrich_instructions

router = APIRouter(prefix="/api/routes", tags=["routing"])


@router.post("", response_model=RoutesResponse)
async def compute_routes(req: RoutesRequest, request: Request) -> RoutesResponse:
    """Compute multi-modal routes between origin and destination."""
    print(f"[routing] REQUEST modes={req.modes} origin=({req.origin.lat:.4f},{req.origin.lng:.4f}) dest=({req.destination.lat:.4f},{req.destination.lng:.4f})")
    dep_date, dep_s = parse_departure(req.departure_time)

    if req.stations is not None:
        _station_list = [s.model_dump() for s in req.stations]
        _sid = "__inline__"
        print(f"[routing] Using {len(_station_list)} stations from request body")
    else:
        _sid = getattr(request.state, "session_id", "")
        _station_list = get_stations(_sid)
        print(f"[routing] Using {len(_station_list)} stations from session '{_sid[:8]}...'")

    # Non-transit routes (walk, bike, bikeshare)
    async with httpx.AsyncClient(timeout=EXTERNAL_TIMEOUT) as client:
        tasks = []
        if "walk" in req.modes:
            tasks.append(compute_walk(req.origin, req.destination, client))
        if "bike" in req.modes:
            tasks.append(compute_bike(req.origin, req.destination, client))
        if "bikeshare" in req.modes:
            tasks.append(compute_bikeshare(req.origin, req.destination, client, _station_list))
        results = await asyncio.gather(*tasks, return_exceptions=True)

    routes = []
    for result in results:
        if isinstance(result, Exception):
            print(f"[routing] Non-transit computation error: {result}")
        elif result is not None:
            routes.append(result)

    # Transit routes: OTP (bus + LRT) with GTFS fallback (LRT-only)
    async with httpx.AsyncClient(timeout=EXTERNAL_TIMEOUT) as client:
        use_otp = await otp_is_available(client)

        transit_tasks: list = []
        if "transit" in req.modes:
            if use_otp:
                transit_tasks.append(compute_transit_otp(req.origin, req.destination, dep_date, dep_s, client))
            else:
                transit_tasks.append(compute_transit_gtfs(req.origin, req.destination, dep_date, dep_s, client))

        if "transit_bike" in req.modes:
            if use_otp:
                transit_tasks.append(compute_transit_bike_otp(req.origin, req.destination, dep_date, dep_s, client, _station_list))
            else:
                transit_tasks.append(compute_transit_bike_gtfs(req.origin, req.destination, dep_date, dep_s, client, _station_list))

        if transit_tasks:
            transit_results = await asyncio.gather(*transit_tasks, return_exceptions=True)
            for result in transit_results:
                if isinstance(result, list):
                    routes.extend(result)
                elif isinstance(result, Exception):
                    print(f"[routing] Transit computation error: {result}")

    notices: list[str] = []
    requested_transit = "transit" in req.modes or "transit_bike" in req.modes
    has_transit = any(r.mode in ("transit", "transit_bike") for r in routes)
    if requested_transit and not has_transit:
        h = dep_s // 3600
        notices.append(f"No transit service found at {h:02d}:{(dep_s % 3600) // 60:02d}. Try a different departure time.")

    requested_bs = "bikeshare" in req.modes or "transit_bike" in req.modes
    has_bs = any(r.mode in ("bikeshare", "transit_bike") for r in routes)
    if requested_bs and not has_bs and _station_list:
        notices.append("No bikeshare routes found — your origin or destination may be too far from a station.")

    routes.sort(key=lambda r: r.total_duration_s)

    print(f"[routing] RESPONSE {len(routes)} routes: {[(r.mode, [l.mode for l in r.legs]) for r in routes]}")

    async with httpx.AsyncClient(timeout=EXTERNAL_TIMEOUT) as elev_client:
        elev_tasks = [enrich_elevation(r, elev_client) for r in routes]
        await asyncio.gather(*elev_tasks, return_exceptions=True)

    for r in routes:
        enrich_instructions(r)

    return RoutesResponse(routes=routes, notices=notices)
