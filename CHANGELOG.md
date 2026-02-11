# Changelog

All notable changes to BikeShareYEG will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/), and this project adheres to [Semantic Versioning](https://semver.org/).

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
