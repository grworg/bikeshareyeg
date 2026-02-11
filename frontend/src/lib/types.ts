/** Shared type definitions — mirrors backend Pydantic models. */

export interface LatLng {
  lat: number;
  lng: number;
}

export interface GeocodedPlace {
  label: string;
  lat: number;
  lng: number;
  type?: string;
}

export interface BikeStation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  capacity: number;
  bikes: number;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export type TravelMode = "walk" | "bike" | "bikeshare" | "transit" | "transit_bike";

export interface RouteLeg {
  mode: "walk" | "bike" | "bus" | "lrt" | "wait";
  geometry: GeoJSON.LineString;
  distance_m: number;
  duration_s: number;
  // Transit-specific (bus/lrt — unified fields)
  transit_route?: string | null;
  transit_color?: string | null;
  transit_headsign?: string | null;
  transit_board_stop?: string | null;
  transit_alight_stop?: string | null;
  transit_board_time?: string | null;  // "HH:MM"
  transit_alight_time?: string | null; // "HH:MM"
  transit_num_stops?: number | null;
  // Wait leg
  wait_until?: string | null; // "HH:MM"
}

export interface StationRef {
  id: string;
  name: string;
  lat: number;
  lng: number;
  bikes: number;
  capacity: number;
}

export interface ElevationPoint {
  distance_m: number;
  elevation_m: number;
}

export interface RouteOption {
  mode: TravelMode;
  legs: RouteLeg[];
  total_distance_m: number;
  total_duration_s: number;
  walk_distance_m: number;
  summary: string;
  pickup_station?: StationRef | null;
  dropoff_station?: StationRef | null;
  departure_time?: string | null;  // "HH:MM"
  arrival_time?: string | null;    // "HH:MM"
  // Elevation
  elevation_profile?: ElevationPoint[] | null;
  total_ascent_m?: number | null;
  total_descent_m?: number | null;
  min_elevation_m?: number | null;
  max_elevation_m?: number | null;
}

// ---------------------------------------------------------------------------
// Overlays
// ---------------------------------------------------------------------------

export type OverlayKey = "lrt" | "bike" | "bus" | "population" | "docks";

// ---------------------------------------------------------------------------
// Planner (auto-optimizer)
// ---------------------------------------------------------------------------

export interface PlannerWeights {
  population: number; // 0-100
  lrt: number;
  bike_infra: number;
  transit: number;
}

export interface PlannerDecayRadii {
  lrt: number;        // metres
  bike_infra: number;
  transit: number;
}

export type PlannerAlgorithm = "iterative_mclp" | "greedy";

export interface PlannerConfig {
  algorithm: PlannerAlgorithm;
  batchSize: number; // stations per MCLP batch (only for iterative_mclp)
  numStations: number;
  coverageRadiusM: number;
  minSpacingM: number;
  // Fleet sizing
  totalBikes: number;
  minDocksPerStation: number;
  maxDocksPerStation: number;
  targetFillPct: number; // 0-1
  // Station proximity discount — reduces suitability near existing stations
  proximityDiscountRadius: number;  // metres (area of effect)
  proximityDiscountStrength: number; // 0-100 (how much to discount)
  // Network connectivity — penalises locations too far from any existing station
  connectivityRadius: number;   // metres — beyond this, isolation penalty kicks in
  connectivityStrength: number; // 0-100 (how much to penalise at very far distances)
}

export interface PlannerCoverage {
  demand_covered_pct: number;
  hexes_covered: number;
  hexes_total: number;
  stations_placed: number;
  total_bikes: number;
  total_docks: number;
  avg_docks_per_station: number;
  population_covered_pct?: number;
  solve_status: string;
}

export interface PlannerFactorInfo {
  key: string;
  name: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Saved Networks (localStorage persistence)
// ---------------------------------------------------------------------------

export interface SavedNetwork {
  /** Schema version — bump when the shape changes so we can migrate. */
  version: 1;
  /** User-chosen name for the draft. */
  name: string;
  /** Unique id (crypto.randomUUID). */
  id: string;
  /** ISO-8601 timestamp of when the draft was saved. */
  savedAt: string;
  /** All bike-share stations in the network. */
  stations: BikeStation[];
  /** Algorithm configuration (fleet size, spacing, etc.). */
  plannerConfig: PlannerConfig;
  /** Goal weights (population, lrt, bike_infra, transit). */
  plannerWeights: PlannerWeights;
  /** Per-factor decay radii. */
  decayRadii: PlannerDecayRadii;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function fmtDuration(seconds: number): string {
  const mins = Math.round(seconds / 60);
  if (mins < 1) return "< 1 min";
  if (mins >= 60) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${mins} min`;
}

export function fmtDistance(metres: number): string {
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres)} m`;
}
