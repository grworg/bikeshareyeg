#!/usr/bin/env python3
"""Generate frontend/src/lib/cityConfig.ts from the active city YAML.

Usage:
    python scripts/generate-frontend-city-config.py [city_name]

If city_name is omitted, reads BIKESHARE_CITY env var (default: edmonton).
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

# Allow running from project root
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

import os

if len(sys.argv) > 1:
    os.environ["BIKESHARE_CITY"] = sys.argv[1]

from src.city_loader import load_city_config

FRONTEND_DIR = Path(__file__).resolve().parent.parent / "frontend"
OUTPUT_TS = FRONTEND_DIR / "src" / "lib" / "cityConfig.ts"
OUTPUT_MANIFEST = FRONTEND_DIR / "public" / "manifest.json"


def main() -> None:
    cfg = load_city_config()

    obj = {
        "name": cfg.name,
        "shortCode": cfg.short_code,
        "region": cfg.region,
        "appName": cfg.app_name,
        "tagline": cfg.tagline,
        "description": cfg.description,
        "siteUrl": cfg.site_url,
        "center": {"lat": cfg.center.lat, "lng": cfg.center.lng},
        "bbox": {
            "south": cfg.bbox.south,
            "west": cfg.bbox.west,
            "north": cfg.bbox.north,
            "east": cfg.bbox.east,
        },
        "initialZoom": cfg.initial_zoom,
        "transit": {
            "rapidTransitLabel": cfg.transit.rapid_transit_label,
            "rapidTransitRouteTypes": cfg.transit.rapid_transit_route_types,
            "rapidTransitColor": cfg.transit.rapid_transit_color,
        },
        "factorLabels": {
            "lrt": cfg.factor_labels.lrt,
            "bike_infra": cfg.factor_labels.bike_infra,
            "transit": cfg.factor_labels.transit,
            "commercial": cfg.factor_labels.commercial,
            "education": cfg.factor_labels.education,
            "recreation": cfg.factor_labels.recreation,
            "population": cfg.factor_labels.population,
        },
    }

    ts_src = (
        "// Auto-generated from cities/{city}.yaml — do not edit manually.\n"
        "// Regenerate with: python scripts/generate-frontend-city-config.py\n\n"
        "export const cityConfig = {cfg_json} as const;\n\n"
        "export type CityConfig = typeof cityConfig;\n"
    ).format(city=cfg.short_code.lower(), cfg_json=json.dumps(obj, indent=2))

    OUTPUT_TS.write_text(ts_src)
    print(f"✓ Generated {OUTPUT_TS.relative_to(FRONTEND_DIR.parent)}")

    manifest = {
        "name": f"{cfg.app_name} — {cfg.tagline}",
        "short_name": cfg.app_name,
        "description": cfg.description,
        "start_url": "/routing",
        "display": "standalone",
        "background_color": "#ffffff",
        "theme_color": "#1a73e8",
        "icons": [
            {"src": "/icons/icon-192.svg", "sizes": "192x192", "type": "image/svg+xml", "purpose": "any maskable"},
            {"src": "/icons/icon-512.svg", "sizes": "512x512", "type": "image/svg+xml", "purpose": "any maskable"},
        ],
    }
    OUTPUT_MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"✓ Generated {OUTPUT_MANIFEST.relative_to(FRONTEND_DIR.parent)}")


if __name__ == "__main__":
    main()
