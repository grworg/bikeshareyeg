# Porting to a New City

This guide walks you through adapting the bike-share planner for your own city. The entire application is configured through a single YAML file — no code changes required for most cities.

## Prerequisites

- **Git** and a **GitHub** account
- **Docker** (for the OpenTripPlanner transit router)
- **Python 3.11+** with a virtual environment
- **Node.js 20+** and **npm**
- A **GTFS feed** for your city's transit system
- Internet access (for Overpass API queries and OSM data download)

## Step-by-Step

### 1. Fork and clone the repository

```bash
gh repo fork grworg/bikeshareyeg --clone
cd bikeshareyeg
```

### 2. Create your city configuration

Copy the Edmonton template and rename it for your city. The filename (without `.yaml`) becomes your city identifier.

```bash
cp cities/edmonton.yaml cities/yourcity.yaml
```

### 3. Edit the YAML

Open `cities/yourcity.yaml` and update every section:

**Identity** — branding and display names:
```yaml
name: "Portland"
short_code: "PDX"
region: "Oregon, USA"
app_name: "BikeSharePDX"
tagline: "Portland Bike-Share Planner"
description: "Design and visualize bike-sharing networks for Portland, OR"
site_url: "https://bikeshare.example.com"
```

**Geography** — center point, bounding box, and projection:
```yaml
center:
  lat: 45.5152
  lng: -122.6784
bbox:
  south: 45.40
  west: -122.85
  north: 45.65
  east: -122.50
initial_zoom: 12.0
utm_epsg: 32610          # UTM zone 10N for Portland
reference_latitude: 45.5  # used for flat-earth distance correction
```

To find the right values:
- **center**: your city hall or downtown core coordinates
- **bbox**: draw a rectangle on [bboxfinder.com](http://bboxfinder.com) that covers the area you want stations in
- **utm_epsg**: look up your UTM zone at [epsg.io](https://epsg.io) (search "UTM zone NN")
- **reference_latitude**: use the center latitude, rounded

**Transit** — rapid transit configuration:
```yaml
transit:
  rapid_transit_label: "MAX"      # or "Subway", "Metro", "BRT", etc.
  rapid_transit_route_types: [0]  # GTFS route_type: 0=tram, 1=subway, 2=rail, 3=bus
  rapid_transit_color: "#d32f2f"  # hex color for map display
  gtfs_path: "data/gtfs/gtfs.zip"
  osm_extract_url: "https://download.geofabrik.de/north-america/us/oregon-latest.osm.pbf"
  osm_filename: "oregon.osm.pbf"
```

To find these values:
- **GTFS feed**: check [transitfeeds.com](https://transitfeeds.com) or your transit agency's open data page
- **route_types**: see [GTFS spec](https://gtfs.org/schedule/reference/#routestxt)
- **osm_extract_url**: browse [download.geofabrik.de](https://download.geofabrik.de) for your region

**Population data**:
```yaml
population:
  # Canadian cities: use "statscan"
  # US cities: use "geojson" (supply your own file) or "us_census" (when implemented)
  provider: "geojson"
```

For Canadian cities, set `provider: "statscan"` and provide the CMA code:
```yaml
population:
  provider: "statscan"
  statscan_cma_code: "602"  # Winnipeg
```

For US cities, the easiest path is to supply a pre-built GeoJSON:
```yaml
population:
  provider: "geojson"
```
Then place your file at `data/overlays/population_density.geojson`. It should be a FeatureCollection where each feature has a `pop_density` property (people per km²).

**Suitability factor labels** — customize the UI labels:
```yaml
factor_labels:
  lrt: "MAX"              # matches your rapid_transit_label
  bike_infra: "Bike Infra"
  transit: "Transit"
  commercial: "Commercial"
  education: "Education"
  recreation: "Recreation"
  population: "Population"
```

### 4. Set the active city

Create or edit your `.env` file in the project root:

```bash
echo 'BIKESHARE_CITY=yourcity' >> .env
```

### 5. Supply data files

Place your GTFS feed:
```bash
mkdir -p data/gtfs
cp /path/to/your/gtfs.zip data/gtfs/gtfs.zip
```

The OSM extract will be downloaded automatically during OTP setup.

### 6. Install dependencies

```bash
# Backend
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"
cd ..

# Frontend
cd frontend
npm install
cd ..
```

### 7. Generate derived configuration

```bash
make city-init
```

This generates:
- `frontend/src/lib/cityConfig.ts` — TypeScript constants for the frontend
- `frontend/public/manifest.json` — PWA manifest with your branding

### 8. Generate population data

```bash
make overlays
```

For `statscan` provider, this downloads and processes Census data automatically. For `geojson` provider, ensure you've already placed the file (step 5).

### 9. Precompute the suitability hex grid

```bash
make hexgrid
```

This runs Overpass queries (cached permanently in `data/overpass_cache/`), builds the road network graph, and scores every H3 hex cell. Takes 10–30 minutes on first run.

### 10. Build the transit routing graph

```bash
make otp-graph
```

Downloads the OSM extract (if needed), builds the OTP graph from OSM + GTFS. Takes 10–20 minutes. Requires Docker.

### 11. Start the development server

```bash
make dev
```

Visit `http://localhost:3000`.

## What Needs Manual Editing

The following files contain city-specific prose that cannot be auto-generated from the YAML:

- **`frontend/src/app/docs/proposal/content.ts`** — the "proposal" / about page. The technical sections (algorithms, architecture) are city-agnostic and can stay as-is. The introductory prose and Edmonton-specific context should be rewritten for your city.

## Population Data Providers

| Provider | Config value | Cities | Status |
|----------|-------------|--------|--------|
| Statistics Canada (2021 Census) | `statscan` | Canadian cities | Implemented |
| US Census Bureau (ACS + TIGER) | `us_census` | US cities | Stub — contributions welcome |
| Pre-built GeoJSON | `geojson` | Any | Implemented (supply your own file) |

To implement a new provider, subclass `PopulationProvider` in `backend/src/data/population.py` and register it in the `get_provider()` factory function.

## Deployment

The deploy script (`scripts/deploy.sh`) reads container names and file paths from the city config. Set these environment variables for your server:

```bash
export DEPLOY_SSH_HOST=myserver
export DEPLOY_REMOTE_DIR=/opt/bikeshare
# DEPLOY_DOMAIN defaults to the domain in your city config's site_url
```

Then:
```bash
make deploy
```

## Troubleshooting

**Overpass queries fail**: The bounding box in your YAML may be too large. Overpass has a timeout of 90 seconds per query. Try a smaller bbox or increase the timeout in `backend/src/optimization/planner.py`.

**OTP graph build fails**: Check that `osm_filename` in your YAML matches the actual downloaded file in `data/otp/`. Ensure you have at least 6 GB of RAM available for the OTP build.

**Missing hex cells**: If parts of your city show no hex coverage, the bbox may not cover the full area. Expand the `bbox` values in your YAML and re-run `make hexgrid`.

**Population data missing**: Check that `data/overlays/population_density.geojson` exists and contains features with a `pop_density` property.
