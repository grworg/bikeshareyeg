"""
Planner API — suitability hex grid and MCLP station optimization.

Endpoints:
  GET  /api/planner/hexgrid   → pre-computed hex grid with factor scores
  POST /api/planner/optimize  → run MCLP, return optimal station placements
  POST /api/planner/step      → greedy single-station placement
  GET  /api/planner/factors   → list available suitability factors
"""

from __future__ import annotations

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field

from src.config import settings
from src.optimization.planner import (
    SuitabilityEngine,
    OptimizeConfig,
    optimize_network,
    step_greedy_one,
    DEFAULT_DECAY_RADII,
    DEFAULT_DENSITY_SCALES,
    DEFAULT_WEIGHTS,
)

router = APIRouter(prefix="/api/planner", tags=["planner"])

# Singleton engine — lazily computes hex grid on first request
_engine: SuitabilityEngine | None = None


def _get_engine() -> SuitabilityEngine:
    global _engine
    if _engine is None:
        _engine = SuitabilityEngine()
    return _engine


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ExistingStation(BaseModel):
    lat: float = Field(..., ge=50.0, le=60.0)
    lng: float = Field(..., ge=-120.0, le=-108.0)
    capacity: int = Field(20, ge=1, le=200)

class OptimizeRequest(BaseModel):
    algorithm: str = Field("iterative_mclp", pattern=r"^(iterative_mclp|greedy)$")
    batch_size: int = Field(5, ge=1, le=50)
    num_stations: int = Field(40, ge=1)
    coverage_radius_m: float = Field(1000.0, ge=50, le=5000)
    min_spacing_m: float = Field(800.0, ge=0, le=5000)
    # Fleet sizing
    total_bikes: int = Field(600, ge=1, le=10000)
    min_docks_per_station: int = Field(15, ge=1, le=200)
    max_docks_per_station: int = Field(30, ge=1, le=200)
    target_fill_pct: float = Field(0.5, ge=0.0, le=1.0)
    # Station proximity discount
    proximity_discount_radius: float = Field(500.0, ge=0, le=10000)
    proximity_discount_strength: float = Field(70.0, ge=0, le=100)
    # Network connectivity
    connectivity_radius: float = Field(2000.0, ge=0, le=20000)
    connectivity_strength: float = Field(60.0, ge=0, le=100)
    # Per-factor decay radii (metres) — proximity-scored factors only
    decay_radii: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_DECAY_RADII))
    # Density scales — for density-scored POI factors (count at score=1.0)
    density_scales: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_DENSITY_SCALES))
    # Factor weights (0-1)
    weights: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_WEIGHTS))
    # Minimum factor thresholds (non-compensatory constraints).
    # A hex must meet ALL active thresholds to be a station candidate.
    # Only keys present are enforced; empty dict = fully compensatory (default).
    min_thresholds: dict[str, float] = Field(default_factory=dict)
    # Existing stations (seeded LRT docks, etc.) — optimizer works around these
    existing_stations: list[ExistingStation] = Field(default_factory=list)


class StepRequest(BaseModel):
    """Lightweight request for a single greedy step."""
    min_spacing_m: float = Field(800.0, ge=0, le=5000)
    min_docks_per_station: int = Field(15, ge=1, le=200)
    max_docks_per_station: int = Field(30, ge=1, le=200)
    target_fill_pct: float = Field(0.5, ge=0.0, le=1.0)
    proximity_discount_radius: float = Field(500.0, ge=0, le=10000)
    proximity_discount_strength: float = Field(70.0, ge=0, le=100)
    connectivity_radius: float = Field(2000.0, ge=0, le=20000)
    connectivity_strength: float = Field(60.0, ge=0, le=100)
    decay_radii: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_DECAY_RADII))
    density_scales: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_DENSITY_SCALES))
    weights: dict[str, float] = Field(default_factory=lambda: dict(DEFAULT_WEIGHTS))
    min_thresholds: dict[str, float] = Field(default_factory=dict)
    existing_stations: list[ExistingStation] = Field(default_factory=list)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@router.get("/factors")
def list_factors():
    """List available suitability factors with their metadata."""
    engine = _get_engine()
    return {"factors": engine.factors}


@router.post("/hexgrid/invalidate")
def invalidate_hexgrid():
    """Clear the cached hex grid, forcing a reload from disk on next request."""
    global _engine
    if _engine is not None:
        _engine._hex_data = None
    return {"status": "ok", "message": "Cache cleared — will reload from disk"}


@router.get("/hexgrid")
def get_hexgrid():
    """Return the H3 hex grid with pre-computed factor scores.

    This is the heaviest call (fetches Overpass data on first run),
    but results are cached in-memory for the lifetime of the server.
    """
    try:
        engine = _get_engine()
        return engine.compute_hex_grid()
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/optimize")
def run_optimize(req: OptimizeRequest, request: Request):
    """Run the MCLP optimizer with the given parameters.

    Returns a list of station placements and coverage statistics.
    """
    # --- Rate limiting applied in main.py via limiter decorator import ---
    # Enforce caps from settings
    if req.num_stations > settings.max_num_stations:
        raise HTTPException(
            status_code=422,
            detail=f"num_stations exceeds maximum of {settings.max_num_stations}",
        )
    if len(req.existing_stations) > settings.max_existing_stations:
        raise HTTPException(
            status_code=422,
            detail=f"existing_stations exceeds maximum of {settings.max_existing_stations}",
        )

    try:
        engine = _get_engine()
        hex_grid = engine.compute_hex_grid()  # cached
        existing = [
            {"lat": s.lat, "lng": s.lng, "capacity": s.capacity}
            for s in req.existing_stations
        ]
        config = OptimizeConfig(
            algorithm=req.algorithm,
            batch_size=req.batch_size,
            num_stations=req.num_stations,
            coverage_radius_m=req.coverage_radius_m,
            min_spacing_m=req.min_spacing_m,
            total_bikes=req.total_bikes,
            min_docks_per_station=req.min_docks_per_station,
            max_docks_per_station=req.max_docks_per_station,
            target_fill_pct=req.target_fill_pct,
            proximity_discount_radius=req.proximity_discount_radius,
            proximity_discount_strength=req.proximity_discount_strength / 100.0,
            connectivity_radius=req.connectivity_radius,
            connectivity_strength=req.connectivity_strength / 100.0,
            decay_radii=req.decay_radii,
            density_scales=req.density_scales,
            weights=req.weights,
            min_thresholds=req.min_thresholds,
            existing_stations=existing,
        )
        result = optimize_network(hex_grid, config)
        return {
            "stations": [
                {
                    "id": s.id,
                    "name": s.name,
                    "lat": s.lat,
                    "lng": s.lng,
                    "capacity": s.capacity,
                    "bikes": s.bikes,
                    "suitability": s.suitability,
                }
                for s in result.stations
            ],
            "coverage": result.coverage,
            "solve_time_s": round(result.solve_time_s, 2),
        }
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))


@router.post("/step")
def run_step(req: StepRequest, request: Request):
    """Place a single station at the greedily optimal location.

    Lightweight endpoint for interactive frame-by-frame network building.
    """
    if len(req.existing_stations) > settings.max_existing_stations:
        raise HTTPException(
            status_code=422,
            detail=f"existing_stations exceeds maximum of {settings.max_existing_stations}",
        )

    try:
        engine = _get_engine()
        hex_grid = engine.compute_hex_grid()  # cached
        existing = [
            {"lat": s.lat, "lng": s.lng, "capacity": s.capacity}
            for s in req.existing_stations
        ]
        config = OptimizeConfig(
            algorithm="greedy",
            num_stations=1,
            min_spacing_m=req.min_spacing_m,
            min_docks_per_station=req.min_docks_per_station,
            max_docks_per_station=req.max_docks_per_station,
            target_fill_pct=req.target_fill_pct,
            proximity_discount_radius=req.proximity_discount_radius,
            proximity_discount_strength=req.proximity_discount_strength / 100.0,
            connectivity_radius=req.connectivity_radius,
            connectivity_strength=req.connectivity_strength / 100.0,
            decay_radii=req.decay_radii,
            density_scales=req.density_scales,
            weights=req.weights,
            min_thresholds=req.min_thresholds,
            existing_stations=existing,
        )
        station = step_greedy_one(hex_grid, config)
        if station is None:
            return {"station": None, "message": "No viable location found"}
        return {
            "station": {
                "id": station.id,
                "name": station.name,
                "lat": station.lat,
                "lng": station.lng,
                "capacity": station.capacity,
                "bikes": station.bikes,
                "suitability": station.suitability,
            }
        }
    except Exception as exc:
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=str(exc))
