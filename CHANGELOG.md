# Changelog

All notable changes to BikeShareYEG will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

## [0.2.0] - 2026-02-09

### Added

- **Per-session station state** — each visitor gets their own network via a session cookie; LRU eviction keeps memory bounded
- **Rate limiting** — slowapi-based limits on optimize (3/min), step (20/min), routes (15/min), and default endpoints (60/min)
- **Input validation** — Pydantic models with range constraints on all planner and station inputs; server-side caps on `num_stations` (100) and `existing_stations` (200)
- **Upstream API caching** — thread-safe LRU caches for BRouter/OSRM routes, Photon geocoding, and elevation data
- **Environment-driven configuration** — all settings (CORS origins, rate limits, session TTL, debug mode) read from `.env` via pydantic-settings with `BIKESHARE_` prefix
- **Production deployment toolkit** (`deploy/`):
  - Caddyfile with auto-HTTPS, security headers, and proxy timeouts
  - systemd units for API (Gunicorn) and frontend (Next.js standalone) with memory/CPU limits
  - `setup.sh` script for one-command Hetzner VM provisioning (UFW, Caddy, Docker, Node, Python)
  - Docker Compose hardened for production (loopback-only ports, memory limits)

### Changed

- CORS origins now configurable via `BIKESHARE_ALLOWED_ORIGINS` (was hardcoded `*`)
- Swagger/ReDoc docs disabled by default (enable with `BIKESHARE_DEBUG=true`)
- OTP Docker container binds to `127.0.0.1` only and has memory limits
- Next.js configured for standalone output mode for lighter deployment
- Frontend fetch calls include `credentials: "include"` for session cookies

## [0.1.0] - 2025-02-09

### Added

- **Route Planner** — multimodal trip planning (walk, bike, transit, bike-share) via OpenTripPlanner with GTFS fallback for LRT routing
- **Network Designer** — click-to-place stations, drag to reposition, click to delete, full undo/redo
- **Optimization Engine** — two algorithms for automated station placement:
  - Iterative MCLP (OR-Tools CP-SAT) with configurable batch size
  - Greedy algorithm with real-time suitability recalculation
- **Step Mode** — place one optimal station at a time and watch the suitability overlay update
- **Suitability Overlay** — H3 hex-grid heatmap with four scoring factors (population density, LRT proximity, bike infrastructure, transit access), adjustable weights and decay radii
- **Saved Networks** — save/load network drafts to localStorage
- **Documentation** — built-in docs site at `/docs` with scroll-spy navigation
- **Overpass API caching** — permanent disk cache for OpenStreetMap queries
- **GPU-rendered stations** — Deck.gl ScatterplotLayer for smooth map interaction with many stations
- **Elevation profiles** — for planned routes
- **OpenTripPlanner** integration via Docker Compose
