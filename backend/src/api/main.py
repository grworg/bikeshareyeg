"""
FastAPI application — serves geocoding, routing, station data, and simulation.
"""

from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.api.geocode import router as geocode_router
from src.api.routing import router as routing_router
from src.api.overlays import router as overlays_router
from src.api.elevation import router as elevation_router
from src.api.planner import router as planner_router
from src.config import settings, EDMONTON_CENTER
from src.data.stations import get_stations, set_stations, reset_stations

app = FastAPI(
    title="BikeShareYEG API",
    description="Bike-sharing network planning & routing API for Edmonton, AB",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:3001"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount sub-routers
app.include_router(geocode_router)
app.include_router(routing_router)
app.include_router(overlays_router)
app.include_router(elevation_router)
app.include_router(planner_router)


# ---------------------------------------------------------------------------
# Health / Info
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {
        "app": settings.app_name,
        "version": "0.2.0",
        "center": {"lat": EDMONTON_CENTER[0], "lng": EDMONTON_CENTER[1]},
    }


@app.get("/health")
async def health():
    return {"status": "ok"}


# ---------------------------------------------------------------------------
# Station endpoints
# ---------------------------------------------------------------------------

@app.get("/api/stations")
async def list_stations():
    """Return the current bike-share station network."""
    return {"stations": get_stations()}


@app.put("/api/stations")
async def replace_stations(body: dict):
    """Replace the entire station network (used by the designer)."""
    stations = body.get("stations", [])
    return {"stations": set_stations(stations)}


@app.post("/api/stations/reset")
async def do_reset_stations():
    """Reset stations back to defaults."""
    return {"stations": reset_stations()}
