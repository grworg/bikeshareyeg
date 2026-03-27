/** Shared type definitions — mirrors backend Pydantic models. */

export type AppMode = "routing" | "designer" | "saved" | "docs";

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

export type OverlayKey = "lrt" | "bike" | "bus" | "population" | "docks" | "commercial" | "education" | "recreation" | "accessibility" | "motorway" | "trunk" | "terrain";

// ---------------------------------------------------------------------------
// Planner (auto-optimizer)
// ---------------------------------------------------------------------------

export interface PlannerWeights {
  population: number; // 0-100
  hilliness: number;
  lrt: number;
  bike_infra: number;
  transit: number;
  commercial: number;
  education: number;
  recreation: number;
}

export interface PlannerDecayRadii {
  lrt: number;        // metres
  bike_infra: number;
  transit: number;
}

/** Density scales for POI factors — the POI count at which score = 1.0.
 *  Uses log normalization: score = min(1, log(1+count) / log(1+scale)). */
export interface PlannerDensityScales {
  commercial: number;
  education: number;
  recreation: number;
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
  // Minimum factor thresholds (non-compensatory constraints)
  // Hex must meet ALL active thresholds. Keys = factor keys, values = min score 0-1.
  minThresholds: Partial<PlannerWeights>;
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
// Build Log — audit trail of how a network was constructed
// ---------------------------------------------------------------------------

/** Snapshot of planner parameters at a given moment. */
export interface BuildLogParams {
  weights: PlannerWeights;
  decayRadii: PlannerDecayRadii;
  densityScales: PlannerDensityScales;
  config: PlannerConfig;
}

export interface BuildLogSeedLRT {
  action: "seed_lrt";
  timestamp: string;
  stationsAdded: string[];  // IDs of stations created
}

export interface BuildLogManualPlace {
  action: "manual_place";
  timestamp: string;
  stationId: string;
  lat: number;
  lng: number;
}

export interface BuildLogStep {
  action: "step";
  timestamp: string;
  stationId: string;
  params: BuildLogParams;
  resultLat: number;
  resultLng: number;
  resultCapacity: number;
}

export interface BuildLogGenerateAll {
  action: "generate_all";
  timestamp: string;
  stationsAdded: string[];  // IDs of stations created
  params: BuildLogParams;
  coverage: PlannerCoverage;
  solveTimeS: number;
}

export interface BuildLogApplyGenerated {
  action: "apply_generated";
  timestamp: string;
  stationsAdded: string[];  // IDs of stations applied
}

export interface BuildLogDeleteStation {
  action: "delete_station";
  timestamp: string;
  stationId: string;
  stationName: string;
}

export interface BuildLogMoveStation {
  action: "move_station";
  timestamp: string;
  stationId: string;
  fromLat: number;
  fromLng: number;
  toLat: number;
  toLng: number;
}

export interface BuildLogClearAll {
  action: "clear_all";
  timestamp: string;
  stationsRemoved: number;
}

export type BuildLogEntry =
  | BuildLogSeedLRT
  | BuildLogManualPlace
  | BuildLogStep
  | BuildLogGenerateAll
  | BuildLogApplyGenerated
  | BuildLogDeleteStation
  | BuildLogMoveStation
  | BuildLogClearAll;

// ---------------------------------------------------------------------------
// Saved Networks (localStorage persistence)
// ---------------------------------------------------------------------------

export interface SavedNetwork {
  /** Schema version — bump when the shape changes so we can migrate. */
  version: 1 | 2;
  /** User-chosen name for the draft. */
  name: string;
  /** Optional description of the network. */
  description?: string;
  /** Optional free-text author name. */
  author?: string;
  /** Unique id (crypto.randomUUID). */
  id: string;
  /** ISO-8601 timestamp of when the draft was saved. */
  savedAt: string;
  /** All bike-share stations in the network. */
  stations: BikeStation[];
  /** Algorithm configuration (fleet size, spacing, etc.). */
  plannerConfig: PlannerConfig;
  /** Factor weights (population, lrt, bike_infra, transit, etc.). */
  plannerWeights: PlannerWeights;
  /** Per-factor decay radii (proximity factors). */
  decayRadii: PlannerDecayRadii;
  /** Per-factor density scales (POI factors). */
  densityScales?: PlannerDensityScales;
  /** Ordered audit log of every action that built this network. */
  buildLog?: BuildLogEntry[];
  /** Server UUID if this network has been published for sharing. */
  shareId?: string;
  /** ISO-8601 timestamp of when the network was published. */
  sharedAt?: string;
}

// ---------------------------------------------------------------------------
// Shared Network (server-side response)
// ---------------------------------------------------------------------------

export interface SharedNetworkResponse {
  id: string;
  name: string;
  description: string;
  author: string;
  station_count: number;
  data: SavedNetwork;
  created_at: string;
  updated_at: string;
  view_count: number;
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
