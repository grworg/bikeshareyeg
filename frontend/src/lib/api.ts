/**
 * API client for the bike-share backend.
 */

import type {
  GeocodedPlace,
  BikeStation,
  RouteOption,
  LatLng,
  TravelMode,
  OverlayKey,
  PlannerWeights,
  PlannerDecayRadii,
  PlannerDensityScales,
  PlannerCoverage,
  PlannerFactorInfo,
  SavedNetwork,
  SharedNetworkResponse,
} from "./types";
import { cityConfig } from "./cityConfig";

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
// Geocoding — calls Photon (Komoot) directly from the browser.
// Bypasses the backend so Docker networking constraints don't matter.
// ---------------------------------------------------------------------------

const PHOTON_URL = "https://photon.komoot.io/api/";
const PHOTON_REVERSE_URL = "https://photon.komoot.io/reverse";
const CITY_LAT = cityConfig.center.lat;
const CITY_LNG = cityConfig.center.lng;
const CITY_BBOX = {
  minLat: cityConfig.bbox.south - 0.04,
  maxLat: cityConfig.bbox.north + 0.02,
  minLng: cityConfig.bbox.west + 0.04,
  maxLng: cityConfig.bbox.east + 0.02,
};

function buildLabel(props: Record<string, string | undefined>): string {
  const parts: string[] = [];
  const name = props.name;
  const housenumber = props.housenumber;
  const street = props.street;

  if (name) parts.push(name);
  if (housenumber && street) {
    const addr = `${housenumber} ${street}`;
    if (addr !== name) parts.push(addr);
  } else if (street && street !== name) {
    parts.push(street);
  }
  const city = props.city;
  if (city && !parts.includes(city)) parts.push(city);
  const state = props.state;
  if (state) parts.push(state);
  return parts.length > 0 ? parts.join(", ") : "Unknown location";
}

export async function geocode(query: string, limit = 5): Promise<GeocodedPlace[]> {
  const params = new URLSearchParams({
    q: query,
    lat: String(CITY_LAT),
    lon: String(CITY_LNG),
    limit: String(limit + 5),
    lang: "en",
  });
  const resp = await fetch(`${PHOTON_URL}?${params}`, {
    headers: { "User-Agent": "BikeShare/0.2" },
  });
  if (!resp.ok) throw new Error(`Geocode failed: ${resp.status}`);
  const data = await resp.json();

  const results: GeocodedPlace[] = [];
  for (const feat of data.features ?? []) {
    const coords: number[] = feat.geometry?.coordinates ?? [];
    if (coords.length < 2) continue;
    const [lng, lat] = coords;
    if (lat < CITY_BBOX.minLat || lat > CITY_BBOX.maxLat ||
        lng < CITY_BBOX.minLng || lng > CITY_BBOX.maxLng) continue;
    results.push({ label: buildLabel(feat.properties ?? {}), lat, lng });
    if (results.length >= limit) break;
  }
  return results;
}

export async function reverseGeocode(lat: number, lng: number): Promise<GeocodedPlace> {
  try {
    const params = new URLSearchParams({ lat: String(lat), lon: String(lng) });
    const resp = await fetch(`${PHOTON_REVERSE_URL}?${params}`, {
      headers: { "User-Agent": "BikeShare/0.2" },
    });
    if (!resp.ok) throw new Error(`Reverse geocode failed: ${resp.status}`);
    const data = await resp.json();
    const features = data.features ?? [];
    if (features.length > 0) {
      return { label: buildLabel(features[0].properties ?? {}), lat, lng };
    }
  } catch { /* fall through to coordinate label */ }
  return { label: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, lat, lng };
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
  stations?: { id: string; name: string; lat: number; lng: number; bikes: number; capacity: number }[],
): Promise<RoutesResult> {
  const body: Record<string, unknown> = { origin, destination, modes };
  if (departureTime) body.departure_time = departureTime;
  if (stations) body.stations = stations;
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
  return `${cityConfig.shortCode.toLowerCase()}_overlay_v2_${key}`;
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
  decay_radii: PlannerDecayRadii;
  density_scales: PlannerDensityScales;
  weights: PlannerWeights;
  min_thresholds: { [key: string]: number };
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
  decay_radii: PlannerDecayRadii;
  density_scales: PlannerDensityScales;
  weights: PlannerWeights;
  min_thresholds: { [key: string]: number };
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
// Hex path exploration (Dijkstra visualization)
// ---------------------------------------------------------------------------

export async function getHexPath(
  h3Id: string,
  factor: string,
): Promise<GeoJSON.FeatureCollection> {
  return fetchJSON<GeoJSON.FeatureCollection>(
    `/planner/hex-path?h3=${encodeURIComponent(h3Id)}&factor=${encodeURIComponent(factor)}`,
  );
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

// ---------------------------------------------------------------------------
// Shared Networks
// ---------------------------------------------------------------------------

export interface ShareNetworkResult {
  id: string;
  name: string;
  station_count: number;
}

export async function shareNetwork(
  ownerTokenHash: string,
  network: SavedNetwork,
): Promise<ShareNetworkResult> {
  return fetchJSON<ShareNetworkResult>("/networks", {
    method: "POST",
    body: JSON.stringify({
      owner_token_hash: ownerTokenHash,
      name: network.name,
      description: network.description ?? "",
      author: network.author ?? "",
      data: network,
    }),
  });
}

export async function getSharedNetwork(
  id: string,
): Promise<SharedNetworkResponse> {
  return fetchJSON<SharedNetworkResponse>(`/networks/${id}`);
}

export async function updateSharedNetwork(
  id: string,
  ownerToken: string,
  updates: { name?: string; description?: string; author?: string; data?: SavedNetwork },
): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_BASE}/networks/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      "X-Owner-Token": ownerToken,
    },
    credentials: "include",
    body: JSON.stringify(updates),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API ${res.status}`);
  }
  return res.json();
}

export async function deleteSharedNetwork(
  id: string,
  ownerToken: string,
): Promise<{ status: string; id: string }> {
  const res = await fetch(`${API_BASE}/networks/${id}`, {
    method: "DELETE",
    headers: {
      "Content-Type": "application/json",
      "X-Owner-Token": ownerToken,
    },
    credentials: "include",
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(text || `API ${res.status}`);
  }
  return res.json();
}
