"""Pydantic models for route requests and responses."""

from __future__ import annotations

from pydantic import BaseModel

from src.api.elevation import ElevationPoint


class LatLng(BaseModel):
    lat: float
    lng: float


class StationPayload(BaseModel):
    id: str
    name: str = "Station"
    lat: float
    lng: float
    bikes: int = 0
    capacity: int = 15


class RoutesRequest(BaseModel):
    origin: LatLng
    destination: LatLng
    modes: list[str] = ["walk", "bike", "bikeshare", "transit", "transit_bike"]
    departure_time: str | None = None
    stations: list[StationPayload] | None = None


class RouteLeg(BaseModel):
    mode: str  # "walk" | "bike" | "bus" | "lrt" | "wait"
    geometry: dict  # GeoJSON LineString
    distance_m: float
    duration_s: float
    transit_route: str | None = None
    transit_color: str | None = None
    transit_headsign: str | None = None
    transit_board_stop: str | None = None
    transit_alight_stop: str | None = None
    transit_board_time: str | None = None
    transit_alight_time: str | None = None
    transit_num_stops: int | None = None
    wait_until: str | None = None


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
    departure_time: str | None = None
    arrival_time: str | None = None
    elevation_profile: list[ElevationPoint] | None = None
    total_ascent_m: float | None = None
    total_descent_m: float | None = None
    min_elevation_m: float | None = None
    max_elevation_m: float | None = None


class RoutesResponse(BaseModel):
    routes: list[RouteOption]
    notices: list[str] = []
