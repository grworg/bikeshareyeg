#!/usr/bin/env python3
"""
Generate population density GeoJSON for the active city.

Dispatches to the appropriate PopulationProvider based on the city config:
  - "statscan"   — StatsCan 2021 Census DA boundaries (Canadian cities)
  - "us_census"  — ACS 5-year + TIGER/Line (US cities, stub)
  - "geojson"    — Pre-supplied file (no generation needed)

For Canadian cities (provider: "statscan"), fetches StatsCan data at the DA level.

Usage:
    python scripts/process-census-data.py            # DA-level (default)
    python scripts/process-census-data.py --neighbourhood  # neighbourhood-level fallback (Edmonton-specific)
"""

from __future__ import annotations

import argparse
import csv
import io
import json
import math
import os
import sys
import zipfile
from pathlib import Path
from typing import Any

try:
    import geopandas as gpd
    import pandas as pd
    import requests
except ImportError as e:
    print(f"Missing dependency: {e}. Run:  pip install geopandas pandas requests", file=sys.stderr)
    sys.exit(1)

# Allow importing from backend/
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
from src.city_loader import load_city_config  # noqa: E402

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

PROJECT_ROOT = Path(__file__).resolve().parents[1]
CACHE_DIR = PROJECT_ROOT / "data" / "cache"
OUTPUT_DIR = PROJECT_ROOT / "data" / "overlays"
OUTPUT_FILE = OUTPUT_DIR / "population_density.geojson"

_city = load_city_config()
CMA_CODE = _city.population.statscan_cma_code or "835"
UTM_EPSG = _city.utm_epsg

# StatsCan download URLs
DA_BOUNDARY_URL = (
    "https://www12.statcan.gc.ca/census-recensement/2021/geo/sip-pis/"
    "boundary-limites/files-fichiers/lda_000b21a_e.zip"
)
CENSUS_PROFILE_PRAIRIES_URL = (
    "https://www12.statcan.gc.ca/census-recensement/2021/dp-pd/prof/"
    "details/download-telecharger/comp/GetFile.cfm?"
    "Lang=E&FILETYPE=CSV&GEONO=006_Prairies"
)

# Edmonton Open Data (neighbourhood-level fallback — Edmonton-specific)
NEIGHBOURHOOD_BOUNDARIES_URL = "https://data.edmonton.ca/resource/5bk4-5txu.json"
NEIGHBOURHOOD_POPULATION_URL = "https://data.edmonton.ca/resource/eg3i-f4bj.json"


# ---------------------------------------------------------------------------
# Download helper with progress
# ---------------------------------------------------------------------------

def _download(url: str, dest: Path, label: str) -> Path:
    """Download a file with progress, caching in CACHE_DIR."""
    if dest.exists():
        mb = dest.stat().st_size / 1_048_576
        print(f"  [cached] {label} ({mb:.1f} MB)")
        return dest
    dest.parent.mkdir(parents=True, exist_ok=True)
    print(f"  Downloading {label} …")
    resp = requests.get(url, stream=True, timeout=30)
    resp.raise_for_status()
    total = int(resp.headers.get("content-length", 0))
    downloaded = 0
    with open(dest, "wb") as f:
        for chunk in resp.iter_content(chunk_size=1_048_576):
            f.write(chunk)
            downloaded += len(chunk)
            if total:
                pct = downloaded / total * 100
                mb = downloaded / 1_048_576
                print(f"\r    {mb:.1f} / {total / 1_048_576:.1f} MB ({pct:.0f}%)", end="", flush=True)
    print()
    return dest


# ---------------------------------------------------------------------------
# Geometry simplification (Ramer-Douglas-Peucker)
# ---------------------------------------------------------------------------

def _simplify_ring(ring: list, tol: float) -> list:
    if len(ring) <= 3:
        return ring

    def _pd(p, a, b):
        dx, dy = b[0] - a[0], b[1] - a[1]
        if dx == 0 and dy == 0:
            return math.hypot(p[0] - a[0], p[1] - a[1])
        t = max(0, min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy)))
        return math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy))

    dmax, idx = 0.0, 0
    for i in range(1, len(ring) - 1):
        d = _pd(ring[i], ring[0], ring[-1])
        if d > dmax:
            dmax, idx = d, i
    if dmax > tol:
        return _simplify_ring(ring[:idx + 1], tol)[:-1] + _simplify_ring(ring[idx:], tol)
    return [ring[0], ring[-1]]


def _simplify_geometry(geom: dict, tolerance: float = 0.00008) -> dict:
    """Simplify a GeoJSON geometry (Polygon or MultiPolygon)."""
    def _process_rings(rings):
        result = []
        for ring in rings:
            s = _simplify_ring(ring, tolerance)
            s = [[round(c[0], 5), round(c[1], 5)] for c in s]
            if len(s) >= 3:
                result.append(s)
        return result

    if geom["type"] == "Polygon":
        simplified = _process_rings(geom["coordinates"])
        if simplified:
            return {"type": "Polygon", "coordinates": simplified}
    elif geom["type"] == "MultiPolygon":
        result = []
        for polygon in geom["coordinates"]:
            simplified = _process_rings(polygon)
            if simplified:
                result.append(simplified)
        if result:
            return {"type": "MultiPolygon", "coordinates": result}
    return geom


# ---------------------------------------------------------------------------
# DA-level processing (primary)
# ---------------------------------------------------------------------------

def process_da_level() -> dict:
    """Download StatsCan DA boundaries + Census Profile, produce GeoJSON."""

    # 1. Download DA boundary shapefile
    print("\n[1/4] DA boundary shapefile")
    boundary_zip = _download(DA_BOUNDARY_URL, CACHE_DIR / "lda_000b21a_e.zip", "DA boundaries (197 MB)")

    # 2. Read with geopandas, filter to Edmonton CMA
    print(f"\n[2/4] Reading & filtering DA boundaries to CMA {CMA_CODE} ({_city.name}) …")
    gdf = gpd.read_file(f"zip://{boundary_zip}")
    print(f"  Total DAs across Canada: {len(gdf):,}")
    print(f"  CRS: {gdf.crs}")
    print(f"  Columns: {list(gdf.columns)}")

    # Reproject to WGS84 first (needed for bbox filtering & GeoJSON output)
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print("  Reprojecting to WGS84 …")
        gdf = gdf.to_crs(epsg=4326)

    # Filter to Edmonton CMA
    cma_col = None
    for col in ["CMAUID", "CMAPUID", "CMANAME"]:
        if col in gdf.columns:
            cma_col = col
            break

    if cma_col and cma_col != "CMANAME":
        edm = gdf[gdf[cma_col] == CMA_CODE].copy()
    elif cma_col == "CMANAME":
        edm = gdf[gdf[cma_col].str.contains(_city.name, case=False, na=False)].copy()
    else:
        # No CMA column — fall back to bounding box from city config
        _b = _city.bbox
        pad = 0.15  # generous padding around configured bbox
        print(f"  No CMAUID column. Filtering DAs by bounding box …")
        edm = gdf.cx[_b.west - pad : _b.east + pad, _b.south - pad : _b.north + pad].copy()

    print(f"  {_city.name} CMA DAs: {len(edm):,}")
    if len(edm) == 0:
        print(f"  ERROR: No DAs found for {_city.name}.")
        sys.exit(1)

    # Get set of DA unique IDs for filtering the census profile
    dauid_col = "DAUID" if "DAUID" in edm.columns else edm.columns[0]
    city_dauids = set(edm[dauid_col].astype(str).values)
    print(f"  DA IDs collected: {len(city_dauids)}")

    # 3. Download Census Profile & extract population for Edmonton DAs
    print("\n[3/4] Census Profile (population extraction)")
    profile_zip_path = _download(
        CENSUS_PROFILE_PRAIRIES_URL,
        CACHE_DIR / "98-401-X2021006_Prairies_eng_CSV.zip",
        "Census Profile Prairies (~436 MB)",
    )

    da_population: dict[str, int] = {}
    print(f"  Scanning Census Profile for {_city.name} DA population …")

    with zipfile.ZipFile(profile_zip_path, "r") as zf:
        # Find the main CSV file inside the zip
        csv_names = [n for n in zf.namelist() if n.endswith(".csv") and "Meta" not in n]
        if not csv_names:
            print("  ERROR: No CSV found in Census Profile zip")
            sys.exit(1)
        csv_name = csv_names[0]
        print(f"  Reading: {csv_name}")

        with zf.open(csv_name) as f:
            # StatsCan CSVs use Windows-1252 encoding (French accented chars)
            text_stream = io.TextIOWrapper(f, encoding="latin-1", errors="replace")
            reader = csv.DictReader(text_stream)

            # Identify column names (they vary by file version)
            # Common patterns: "DGUID", "GEO_CODE (POR)", "CHARACTERISTIC_ID",
            #   "C1_COUNT_TOTAL", "ALT_GEO_CODE"
            row_count = 0
            matched = 0

            for row in reader:
                row_count += 1
                if row_count % 5_000_000 == 0:
                    print(f"    … scanned {row_count:,} rows, matched {matched} DAs so far")

                # Check if this row is for an Edmonton DA
                geo_code = row.get("ALT_GEO_CODE") or row.get("GEO_CODE (POR)") or ""
                if geo_code not in city_dauids:
                    continue

                # Check if this is the "Population, 2021" characteristic (ID = 1)
                char_id = row.get("CHARACTERISTIC_ID", "")
                if str(char_id) != "1":
                    continue

                # Extract the count
                count_str = (
                    row.get("C1_COUNT_TOTAL")
                    or row.get("C_TOTAL")
                    or row.get("T_DATA_QUALITY_FLAG")
                    or "0"
                )
                count_str = count_str.strip().replace(",", "")
                try:
                    da_population[geo_code] = int(float(count_str))
                    matched += 1
                except (ValueError, TypeError):
                    pass

                # Early exit if we've found all Edmonton DAs
                if matched >= len(city_dauids):
                    break

    print(f"  Population data matched: {len(da_population):,} DAs out of {len(city_dauids):,}")

    # 4. Build GeoJSON
    print("\n[4/4] Building GeoJSON …")
    features: list[dict[str, Any]] = []

    for _, row in edm.iterrows():
        dauid = str(row[dauid_col])
        pop = da_population.get(dauid)
        if pop is None:
            continue  # skip DAs without population data

        # Compute area in km² from the geometry
        geom = row.geometry
        # Use a projected CRS for accurate area computation
        area_km2 = geom.to_crs(epsg=3857).area / 1_000_000 if hasattr(geom, "to_crs") else 0
        # geopandas Series row doesn't have to_crs — use the GeoDataFrame
        # We'll compute area in bulk below instead
        area_km2 = 0  # placeholder

        geojson_geom = json.loads(gpd.GeoSeries([row.geometry], crs="EPSG:4326").to_json())
        geojson_geom = geojson_geom["features"][0]["geometry"]

        # Simplify
        geojson_geom = _simplify_geometry(geojson_geom)

        features.append({
            "type": "Feature",
            "properties": {
                "dauid": dauid,
                "population": pop,
                "area_km2": 0,      # filled in below
                "density": 0,       # filled in below
            },
            "geometry": geojson_geom,
        })

    edm_utm = edm.to_crs(epsg=UTM_EPSG)
    area_map: dict[str, float] = {}
    for _, row in edm_utm.iterrows():
        dauid = str(row[dauid_col])
        area_map[dauid] = row.geometry.area / 1_000_000  # m² → km²

    for feat in features:
        dauid = feat["properties"]["dauid"]
        area = area_map.get(dauid, 0.001)
        area = max(area, 0.001)
        pop = feat["properties"]["population"]
        feat["properties"]["area_km2"] = round(area, 4)
        feat["properties"]["density"] = round(pop / area, 1)

    # Sort by density descending
    features.sort(key=lambda f: f["properties"]["density"], reverse=True)

    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------------------
# Neighbourhood-level fallback (Edmonton Open Data)
# ---------------------------------------------------------------------------

def _ring_area_m2(ring: list[list[float]]) -> float:
    n = len(ring)
    if n < 3:
        return 0.0
    R = 6_371_000
    total = 0.0
    for i in range(n):
        j = (i + 1) % n
        lat1 = math.radians(ring[i][1])
        lat2 = math.radians(ring[j][1])
        dlng = math.radians(ring[j][0] - ring[i][0])
        total += dlng * (2 + math.sin(lat1) + math.sin(lat2))
    return abs(total) * R * R / 2.0


def _multipolygon_area_km2(coords: list) -> float:
    total_m2 = 0.0
    for polygon in coords:
        if polygon:
            total_m2 += _ring_area_m2(polygon[0])
            for hole in polygon[1:]:
                total_m2 -= _ring_area_m2(hole)
    return max(total_m2 / 1_000_000, 0.001)


def process_neighbourhood_level() -> dict:
    """Neighbourhood-level fallback using Edmonton Open Data (Edmonton-specific, no large downloads)."""
    print("\nFetching neighbourhood boundaries …")
    resp_b = requests.get(NEIGHBOURHOOD_BOUNDARIES_URL, params={"$limit": 5000}, timeout=120)
    resp_b.raise_for_status()
    boundaries = resp_b.json()
    print(f"  → {len(boundaries)} neighbourhood boundary records")

    print("Fetching population data …")
    resp_p = requests.get(NEIGHBOURHOOD_POPULATION_URL, params={"$limit": 5000}, timeout=60)
    resp_p.raise_for_status()
    populations = resp_p.json()
    print(f"  → {len(populations)} neighbourhood population records")

    pop_lookup: dict[str, int] = {}
    for row in populations:
        num = str(row.get("neighbourhood_number", "")).strip()
        try:
            pop_lookup[num] = int(str(row.get("total_population", "0")).strip())
        except ValueError:
            continue

    features: list[dict[str, Any]] = []
    for rec in boundaries:
        geom = rec.get("the_geom")
        if not geom or geom.get("type") != "MultiPolygon":
            continue
        raw_num = str(rec.get("neighbourh", "")).strip()
        try:
            num = str(int(float(raw_num)))
        except (ValueError, TypeError):
            continue
        name = rec.get("descriptiv") or rec.get("name", "")
        population = pop_lookup.get(num)
        if population is None:
            continue
        area_km2 = _multipolygon_area_km2(geom["coordinates"])
        density = round(population / area_km2, 1)
        simplified_geom = _simplify_geometry(geom, tolerance=0.0001)
        features.append({
            "type": "Feature",
            "properties": {
                "name": name,
                "neighbourhood_number": num,
                "population": population,
                "area_km2": round(area_km2, 3),
                "density": density,
            },
            "geometry": simplified_geom,
        })

    features.sort(key=lambda f: f["properties"]["density"], reverse=True)
    return {"type": "FeatureCollection", "features": features}


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(description="Process census data for population density overlay")
    parser.add_argument(
        "--neighbourhood", action="store_true",
        help="Use neighbourhood-level data from Edmonton Open Data (Edmonton-specific, faster, less granular)",
    )
    args = parser.parse_args()

    provider = _city.population.provider
    print(f"City: {_city.name} ({_city.short_code}), population provider: {provider}")

    if provider == "geojson":
        if OUTPUT_FILE.exists():
            print(f"✓ Pre-supplied {OUTPUT_FILE} already exists, nothing to do.")
            return
        print(f"ERROR: provider=geojson but {OUTPUT_FILE} not found.")
        print("  Place your population_density.geojson there manually.")
        sys.exit(1)

    if provider == "us_census":
        print("ERROR: us_census provider is not yet implemented.")
        print("  Set population.provider to 'geojson' and supply the file manually.")
        sys.exit(1)

    if args.neighbourhood:
        print("=== Neighbourhood-level population density ===")
        geojson = process_neighbourhood_level()
    else:
        print("=== Dissemination Area (DA) level population density ===")
        geojson = process_da_level()

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w") as f:
        json.dump(geojson, f, separators=(",", ":"))

    size_kb = OUTPUT_FILE.stat().st_size / 1024
    n = len(geojson["features"])
    print(f"\n{'='*60}")
    print(f"✓ Wrote {n:,} features to {OUTPUT_FILE}")
    print(f"  File size: {size_kb:.0f} KB")

    densities = [feat["properties"]["density"] for feat in geojson["features"]]
    if densities:
        print(f"  Density range: {min(densities):.0f} – {max(densities):.0f} people/km²")
        avg = sum(densities) / len(densities)
        print(f"  Mean density: {avg:.0f} people/km²")
        top5 = geojson["features"][:5]
        print(f"\n  Top 5 densest areas:")
        for feat in top5:
            p = feat["properties"]
            label = p.get("name") or f"DA {p.get('dauid', '?')}"
            print(f"    {label:30s}  {p['density']:>8,.0f} /km²  (pop {p['population']:,})")


if __name__ == "__main__":
    main()
