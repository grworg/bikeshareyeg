// Auto-generated from cities/yeg.yaml — do not edit manually.
// Regenerate with: python scripts/generate-frontend-city-config.py

export const cityConfig = {
  "name": "Edmonton",
  "shortCode": "YEG",
  "region": "Alberta, Canada",
  "appName": "BikeShareYEG",
  "tagline": "Edmonton Bike-Share Planner",
  "description": "Design, simulate, and visualize bike-sharing networks for Edmonton, AB",
  "siteUrl": "https://bikeshare.grassrootswork.org",
  "center": {
    "lat": 53.5461,
    "lng": -113.4937
  },
  "bbox": {
    "south": 53.35,
    "west": -113.75,
    "north": 53.7,
    "east": -113.25
  },
  "initialZoom": 11.5,
  "transit": {
    "rapidTransitLabel": "LRT",
    "rapidTransitRouteTypes": [
      0
    ],
    "rapidTransitColor": "#7b1fa2"
  },
  "factorLabels": {
    "lrt": "LRT",
    "bike_infra": "Bike Infra",
    "transit": "Transit",
    "commercial": "Commercial",
    "education": "Education",
    "recreation": "Recreation",
    "population": "Population",
    "hilliness": "Terrain"
  }
} as const;

export type CityConfig = typeof cityConfig;
