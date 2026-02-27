"""Walk, bike, and bikeshare route computation."""

from __future__ import annotations

import asyncio
from typing import Any

import httpx

from src.api.routing.models import LatLng, RouteLeg, RouteOption, StationRef
from src.api.routing.helpers import haversine_m, fmt_dist
from src.api.routing.engines import route

MAX_WALK_TO_STATION_M = 1500


async def compute_walk(origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> RouteOption | None:
    result = await route("walk", origin, dest, client)
    return RouteOption(
        mode="walk",
        legs=[RouteLeg(mode="walk", **result)],
        total_distance_m=result["distance_m"],
        total_duration_s=result["duration_s"],
        walk_distance_m=result["distance_m"],
        summary=f"Walk — {fmt_dist(result['distance_m'])}",
    )


async def compute_bike(origin: LatLng, dest: LatLng, client: httpx.AsyncClient) -> RouteOption | None:
    result = await route("bike", origin, dest, client)
    return RouteOption(
        mode="bike",
        legs=[RouteLeg(mode="bike", **result)],
        total_distance_m=result["distance_m"],
        total_duration_s=result["duration_s"],
        walk_distance_m=0,
        summary=f"Bike — {fmt_dist(result['distance_m'])}",
    )


async def compute_bikeshare(
    origin: LatLng, dest: LatLng, client: httpx.AsyncClient,
    stations: list[dict] | None = None,
) -> RouteOption | None:
    if not stations:
        return None
    pickups = [
        (d, s) for s in stations if s["bikes"] > 0
        for d in [haversine_m(origin.lat, origin.lng, s["lat"], s["lng"])]
        if d <= MAX_WALK_TO_STATION_M
    ]
    pickups.sort(key=lambda x: x[0])
    dropoffs = [
        (d, s) for s in stations if s["bikes"] < s["capacity"]
        for d in [haversine_m(dest.lat, dest.lng, s["lat"], s["lng"])]
        if d <= MAX_WALK_TO_STATION_M
    ]
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
            route("walk", origin, pll, client),
            route("bike", pll, dll, client),
            route("walk", dll, dest, client),
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
