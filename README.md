# BikeShareYEG

**Design, simulate, and visualize bike-sharing networks for Edmonton, AB.**

An open-source urban planning tool that combines geospatial data processing, discrete-event simulation, facility location optimization, and interactive map visualization to help plan a bike-sharing system for Edmonton.

---

## Architecture

```
bikeshareyeg/
├── backend/              # Python — data processing, simulation, API
│   ├── src/
│   │   ├── api/          # FastAPI server
│   │   ├── data/         # Edmonton data fetching (OSM, Open Data Portal)
│   │   ├── simulation/   # SimPy discrete-event simulation engine
│   │   └── optimization/ # OR-Tools station placement optimizer
│   └── pyproject.toml
├── frontend/             # TypeScript — interactive map UI
│   ├── src/
│   │   ├── app/          # Next.js app router
│   │   ├── components/   # DeckMap, Sidebar, etc.
│   │   └── lib/          # API client, constants
│   └── package.json
├── notebooks/            # Jupyter notebooks for exploration
│   └── 01_explore_edmonton.ipynb
└── data/                 # Local data cache (gitignored)
    ├── raw/
    ├── processed/
    └── cache/
```

## Tech Stack

### Backend (Python)

| Library | Version | Purpose |
|---------|---------|---------|
| **FastAPI** | ≥0.115 | REST API server |
| **OSMnx** | ≥2.0 | OpenStreetMap street network data |
| **GeoPandas** | ≥1.0 | Geospatial DataFrames |
| **NetworkX** | ≥3.4 | Graph algorithms (routing, centrality) |
| **SimPy** | ≥4.1 | Discrete-event simulation |
| **OR-Tools** | ≥9.9 | Station placement optimization (MCLP) |
| **H3** | ≥4.1 | Hexagonal spatial indexing |
| **DuckDB** | ≥1.1 | Fast analytical queries |
| **PyDeck** | ≥0.9 | deck.gl in Jupyter notebooks |

### Frontend (TypeScript)

| Library | Version | Purpose |
|---------|---------|---------|
| **Next.js** | 15 | React framework |
| **deck.gl** | 9 | WebGL geospatial visualization layers |
| **MapLibre GL JS** | 4 | Open-source base map (no API key) |
| **Turf.js** | 7 | Client-side geospatial operations |
| **Tailwind CSS** | 4 | Utility-first styling |

## Data Sources

| Source | Data | URL |
|--------|------|-----|
| **OpenStreetMap** | Street network, bike lanes, POIs | via OSMnx |
| **Edmonton Open Data** | Bike infra, traffic counts, neighbourhoods, GTFS | [data.edmonton.ca](https://data.edmonton.ca) |
| **Statistics Canada** | Census population by dissemination area | [statcan.gc.ca](https://www.statcan.gc.ca) |

## Getting Started

### Prerequisites

- Python ≥ 3.11
- Node.js ≥ 20
- (Recommended) [uv](https://docs.astral.sh/uv/) for fast Python dependency management

### Backend Setup

```bash
cd backend

# Option A: using uv (recommended)
uv venv
source .venv/bin/activate
uv pip install -e .

# Option B: using pip
python -m venv .venv
source .venv/bin/activate
pip install -e .
```

Start the API server:

```bash
uvicorn src.api.main:app --reload --port 8000
```

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend runs on `http://localhost:3000` and proxies `/api/*` to the backend on port 8000.

### Notebooks

```bash
cd backend
source .venv/bin/activate
jupyter lab --notebook-dir=../notebooks
```

### Environment Variables

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Optionally set `BIKESHARE_EDMONTON_APP_TOKEN` for higher rate limits on the Edmonton Open Data API. Register at [data.edmonton.ca](https://data.edmonton.ca/profile/edit/developer_settings).

## How It Works

### 1. Data Ingestion
- **OSMnx** downloads Edmonton's cycling-usable street network from OpenStreetMap
- **Edmonton Open Data API** provides official bike infrastructure, traffic volumes, and neighbourhood boundaries
- Data is cached locally as Parquet files for fast reloading

### 2. Demand Estimation
- **H3 hex grid** covers Edmonton at configurable resolution
- Points of interest (transit stops, universities, commercial areas) are aggregated per hex cell
- Population density and traffic volumes weight demand scores

### 3. Station Placement Optimization
- **OR-Tools** solves the Maximal Covering Location Problem (MCLP)
- Given candidate locations (hex centroids) and demand scores, selects K optimal station locations
- Configurable coverage radius and station count

### 4. Simulation
- **SimPy** runs a discrete-event simulation of the bike-sharing system
- Models trip generation (Poisson process), bike pickup/return, dock capacity constraints
- Tracks service rate, station occupancy over time, failed trips

### 5. Visualization
- **deck.gl + MapLibre** renders an interactive 3D map
- Layers: bike network paths, station markers (color-coded by occupancy), trip arcs, H3 demand heatmap
- Click to place stations, run simulation, see results in real-time

## Key Features

- **Click-to-place stations** on the interactive map
- **Auto-optimize** station locations using OR-Tools
- **Run 24-hour simulations** and see service rate, trip flows, station imbalances
- **Toggle data layers** (bike network, demand heatmap, trip arcs)
- **Jupyter notebooks** for deep data exploration with PyDeck
- **No API keys required** — uses open-source MapLibre with CARTO basemaps

## License

MIT
