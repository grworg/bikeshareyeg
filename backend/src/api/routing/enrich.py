"""Elevation enrichment for computed routes."""

from __future__ import annotations

import httpx

from src.api.elevation import compute_elevation_profile
from src.api.routing.models import RouteOption


async def enrich_elevation(route: RouteOption, client: httpx.AsyncClient) -> None:
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
