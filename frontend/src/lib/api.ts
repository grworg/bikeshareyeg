/**
 * API client for the BikeShareYEG backend.
 */

import type {
  GeocodedPlace,
  BikeStation,
  RouteOption,
  LatLng,
  TravelMode,
  OverlayKey,
  PlannerWeights,
  PlannerCoverage,
  PlannerFactorInfo,
} from "./types";

const API_BASE = "/api";

async function fetchJSON<T = unknown>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { "Content-Type": "application/json" },
    credentials: "include",        // send session cookie
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Try to extract a human-readable message from FastAPI validation errors
    let message = `API ${res.status}`;
    try {
      const body = JSON.parse(text);
      if (Array.isArray(body?.detail)) {
        // Pydantic validation errors
        message = body.detail
          .map((e: { loc?: string[]; msg?: string }) => {
            const field = e.loc?.slice(1).join(".") ?? "unknown";
            return `${field}: ${e.msg}`;
          })
          .join("; ");
      } else if (typeof body?.detail === "string") {
        message = body.detail;
      }
    } catch {
      if (text) message = text;
    }
    throw new Error(message);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export async function geocode(query: string, limit = 5): Promise<GeocodedPlace[]> {
  const params = new URLSearchParams({ q: query, limit: String(limit) });
  return fetchJSON<GeocodedPlace[]>(`/geocode?${params}`);
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedPlace> {
  const params = new URLSearchParams({ lat: String(lat), lng: String(lng) });
  return fetchJSON<GeocodedPlace>(`/geocode/reverse?${params}`);
}

// ---------------------------------------------------------------------------
// Stations
// ---------------------------------------------------------------------------

export async function getStations(): Promise<BikeStation[]> {
  const data = await fetchJSON<{ stations: BikeStation[] }>("/stations");
  return data.stations;
}

export async function saveStations(stations: BikeStation[]): Promise<BikeStation[]> {
  const data = await fetchJSON<{ stations: BikeStation[] }>("/stations", {
    method: "PUT",
    body: JSON.stringify({ stations }),
  });
  return data.stations;
}

export async function resetStations(): Promise<BikeStation[]> {
  const data = await fetchJSON<{ stations: BikeStation[] }>("/stations/reset", {
    method: "POST",
  });
  return data.stations;
}

export async function clearStations(): Promise<BikeStation[]> {
  const data = await fetchJSON<{ stations: BikeStation[] }>("/stations/clear", {
    method: "POST",
  });
  return data.stations;
}

// ---------------------------------------------------------------------------
// Routing
// ---------------------------------------------------------------------------

export interface RoutesResult {
  routes: RouteOption[];
  notices: string[];
}

export async function computeRoutes(
  origin: LatLng,
  destination: LatLng,
  modes: TravelMode[] = ["walk", "bike", "bikeshare", "transit", "transit_bike"],
  departureTime?: string | null,
): Promise<RoutesResult> {
  const body: Record<string, unknown> = { origin, destination, modes };
  if (departureTime) body.departure_time = departureTime;
  const data = await fetchJSON<{ routes: RouteOption[]; notices?: string[] }>("/routes", {
    method: "POST",
    body: JSON.stringify(body),
  });
  return { routes: data.routes, notices: data.notices ?? [] };
}

// ---------------------------------------------------------------------------
// Overlays (cached in localStorage for 24 hours)
// ---------------------------------------------------------------------------

const OVERLAY_CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

const overlayMemCache: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>> = {};

function _overlayStorageKey(key: OverlayKey): string {
  // v2: DA-level population density (was neighbourhood-level in v1)
  return `bikeshareyeg_overlay_v2_${key}`;
}

function _readOverlayFromStorage(key: OverlayKey): GeoJSON.FeatureCollection | null {
  try {
    const raw = localStorage.getItem(_overlayStorageKey(key));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw) as { ts: number; data: GeoJSON.FeatureCollection };
    if (Date.now() - ts > OVERLAY_CACHE_TTL_MS) {
      localStorage.removeItem(_overlayStorageKey(key));
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function _writeOverlayToStorage(key: OverlayKey, data: GeoJSON.FeatureCollection): void {
  try {
    localStorage.setItem(_overlayStorageKey(key), JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // localStorage full or unavailable — ignore
  }
}

// ---------------------------------------------------------------------------
// Planner (auto-optimizer)
// ---------------------------------------------------------------------------

let _hexGridCache: GeoJSON.FeatureCollection | null = null;

export async function getPlannerHexGrid(): Promise<GeoJSON.FeatureCollection> {
  if (_hexGridCache) return _hexGridCache;
  const data = await fetchJSON<GeoJSON.FeatureCollection>("/planner/hexgrid");
  _hexGridCache = data;
  return data;
}

export async function getPlannerFactors(): Promise<PlannerFactorInfo[]> {
  const data = await fetchJSON<{ factors: PlannerFactorInfo[] }>("/planner/factors");
  return data.factors;
}

export interface OptimizeResponse {
  stations: BikeStation[];
  coverage: PlannerCoverage;
  solve_time_s: number;
}

export async function runPlannerOptimize(params: {
  algorithm: string;
  batch_size: number;
  num_stations: number;
  coverage_radius_m: number;
  min_spacing_m: number;
  total_bikes: number;
  min_docks_per_station: number;
  max_docks_per_station: number;
  target_fill_pct: number;
  proximity_discount_radius: number;
  proximity_discount_strength: number;
  connectivity_radius: number;
  connectivity_strength: number;
  decay_radii: { lrt: number; bike_infra: number; transit: number };
  weights: PlannerWeights;
  existing_stations: { lat: number; lng: number; capacity: number }[];
}): Promise<OptimizeResponse> {
  // Normalize weights from 0-100 sliders to 0-1
  const normalizedWeights: { [key: string]: number } = {};
  for (const [k, v] of Object.entries(params.weights)) {
    normalizedWeights[k] = v / 100;
  }
  return fetchJSON<OptimizeResponse>("/planner/optimize", {
    method: "POST",
    body: JSON.stringify({
      ...params,
      weights: normalizedWeights,
    }),
  });
}

export interface StepResponse {
  station: BikeStation | null;
  message?: string;
}

export async function stepPlanner(params: {
  min_spacing_m: number;
  min_docks_per_station: number;
  max_docks_per_station: number;
  target_fill_pct: number;
  proximity_discount_radius: number;
  proximity_discount_strength: number;
  connectivity_radius: number;
  connectivity_strength: number;
  decay_radii: { lrt: number; bike_infra: number; transit: number };
  weights: PlannerWeights;
  existing_stations: { lat: number; lng: number; capacity: number }[];
}): Promise<StepResponse> {
  const normalizedWeights: { [key: string]: number } = {};
  for (const [k, v] of Object.entries(params.weights)) {
    normalizedWeights[k] = v / 100;
  }
  return fetchJSON<StepResponse>("/planner/step", {
    method: "POST",
    body: JSON.stringify({
      ...params,
      weights: normalizedWeights,
    }),
  });
}

// ---------------------------------------------------------------------------
// Overlays (cached in localStorage for 24 hours)
// ---------------------------------------------------------------------------

export async function getOverlay(
  key: OverlayKey,
): Promise<GeoJSON.FeatureCollection> {
  // 1. In-memory cache (instant)
  if (overlayMemCache[key]) return overlayMemCache[key]!;

  // 2. localStorage cache (survives refresh, 24h TTL)
  const stored = _readOverlayFromStorage(key);
  if (stored) {
    overlayMemCache[key] = stored;
    return stored;
  }

  // 3. Fetch from backend
  const data = await fetchJSON<GeoJSON.FeatureCollection>(`/overlays/${key}`);
  overlayMemCache[key] = data;
  _writeOverlayToStorage(key, data);
  return data;
}
