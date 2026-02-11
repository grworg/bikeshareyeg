"""
FastAPI application — serves geocoding, routing, station data, and optimisation.

Production hardening:
  - Per-session station state (cookie-based, LRU-evicted)
  - Rate limiting via slowapi
  - CORS from env config
  - Swagger docs disabled unless debug=True
"""

from __future__ import annotations

import uuid

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from pydantic import BaseModel, Field, field_validator

from src.api.geocode import router as geocode_router
from src.api.routing import router as routing_router
from src.api.overlays import router as overlays_router
from src.api.elevation import router as elevation_router
from src.api.planner import router as planner_router
from src.config import settings, EDMONTON_CENTER
from src.data.stations import get_stations, set_stations, reset_stations, create_session

# ---------------------------------------------------------------------------
# Rate limiter (keyed by client IP)
# ---------------------------------------------------------------------------

limiter = Limiter(key_func=get_remote_address)

# ---------------------------------------------------------------------------
# App
# ---------------------------------------------------------------------------

app = FastAPI(
    title="BikeShareYEG API",
    description="Bike-sharing network planning & routing API for Edmonton, AB",
    version="0.2.0",
    docs_url="/docs" if settings.debug else None,
    redoc_url="/redoc" if settings.debug else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# --- CORS ---
origins = [o.strip() for o in settings.allowed_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Session middleware — sets / reads a session cookie
# ---------------------------------------------------------------------------

@app.middleware("http")
async def session_middleware(request: Request, call_next):
    cookie_name = settings.session_cookie
    sid = request.cookies.get(cookie_name)

    # Validate or create session
    if not sid or not _is_valid_hex(sid):
        sid = create_session()

    request.state.session_id = sid
    response: Response = await call_next(request)

    # Set/refresh cookie on every response
    # In production the upstream reverse proxy terminates TLS, so we check
    # the X-Forwarded-Proto header (set by Caddy) to decide Secure flag.
    is_https = request.headers.get("x-forwarded-proto") == "https"
    response.set_cookie(
        key=cookie_name,
        value=sid,
        max_age=settings.session_ttl_s,
        httponly=True,
        samesite="lax",
        secure=is_https,
    )
    return response


def _is_valid_hex(s: str) -> bool:
    """Check that a session ID looks like a hex uuid (32 chars)."""
    return len(s) == 32 and all(c in "0123456789abcdef" for c in s)


# ---------------------------------------------------------------------------
# Mount sub-routers
# ---------------------------------------------------------------------------

app.include_router(geocode_router)
app.include_router(routing_router)
app.include_router(overlays_router)
app.include_router(elevation_router)
app.include_router(planner_router)

# ---------------------------------------------------------------------------
# Apply rate limits to sub-router endpoints
# ---------------------------------------------------------------------------
# slowapi needs the limiter on routes — we apply here after mounting so the
# sub-routers don't need to import the limiter instance.

from src.api.planner import router as _pr  # noqa: already imported
for route in app.routes:
    path = getattr(route, "path", "")
    methods = getattr(route, "methods", set())
    endpoint = getattr(route, "endpoint", None)
    if endpoint is None:
        continue
    if path == "/api/planner/optimize" and "POST" in methods:
        route.endpoint = limiter.limit(settings.rate_limit_optimize)(endpoint)
    elif path == "/api/planner/step" and "POST" in methods:
        route.endpoint = limiter.limit(settings.rate_limit_step)(endpoint)
    elif path == "/api/routes" and "POST" in methods:
        route.endpoint = limiter.limit(settings.rate_limit_routes)(endpoint)


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
# Station endpoints — session-scoped
# ---------------------------------------------------------------------------

class StationInput(BaseModel):
    """Schema for a single station in the PUT body."""
    id: str = Field(..., max_length=100)
    name: str = Field("", max_length=200)
    lat: float = Field(..., ge=50.0, le=60.0)
    lng: float = Field(..., ge=-120.0, le=-108.0)
    capacity: int = Field(20, ge=1, le=200)
    bikes: int = Field(10, ge=0)

    @field_validator("bikes")
    @classmethod
    def bikes_le_capacity(cls, v, info):
        cap = info.data.get("capacity", 200)
        return min(v, cap)


class StationsBody(BaseModel):
    stations: list[StationInput] = Field(
        ..., max_length=settings.max_existing_stations,
    )


@app.get("/api/stations")
@limiter.limit(settings.rate_limit_default)
async def list_stations(request: Request):
    """Return the current bike-share station network for this session."""
    sid = request.state.session_id
    return {"stations": get_stations(sid)}


@app.put("/api/stations")
@limiter.limit(settings.rate_limit_default)
async def replace_stations(body: StationsBody, request: Request):
    """Replace the entire station network for this session."""
    sid = request.state.session_id
    stations = [s.model_dump() for s in body.stations]
    return {"stations": set_stations(sid, stations)}


@app.post("/api/stations/reset")
@limiter.limit(settings.rate_limit_default)
async def do_reset_stations(request: Request):
    """Reset stations back to defaults for this session."""
    sid = request.state.session_id
    return {"stations": reset_stations(sid)}
