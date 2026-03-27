/**
 * Pure utility functions for navigation mode:
 *  - snap GPS to route polyline
 *  - measure distance along route
 *  - find next instruction
 *  - compute ETA
 */

import type { Instruction, RouteOption, RouteLeg } from "./types";

// ---------------------------------------------------------------------------
// Haversine & bearing helpers
// ---------------------------------------------------------------------------

const R = 6_371_000; // earth radius in metres
const DEG = Math.PI / 180;

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = (lat2 - lat1) * DEG;
  const dLng = (lng2 - lng1) * DEG;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * DEG;
  const y = Math.sin(dLng) * Math.cos(lat2 * DEG);
  const x =
    Math.cos(lat1 * DEG) * Math.sin(lat2 * DEG) -
    Math.sin(lat1 * DEG) * Math.cos(lat2 * DEG) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

// ---------------------------------------------------------------------------
// Flatten route into a single coordinate array with cumulative distances
// ---------------------------------------------------------------------------

export interface FlatRoute {
  coords: [number, number][]; // [lng, lat]
  cumDist: number[];          // cumulative metres from start
  totalDist: number;
  instructions: Instruction[];
}

export function flattenRoute(route: RouteOption): FlatRoute {
  const coords: [number, number][] = [];
  const instructions: Instruction[] = [];
  let distOffset = 0;

  for (const leg of route.legs) {
    if (leg.mode === "wait") continue;
    const legCoords = (leg.geometry?.coordinates ?? []) as [number, number][];

    if (leg.instructions) {
      for (const inst of leg.instructions) {
        instructions.push({ ...inst, distance_m: inst.distance_m + distOffset });
      }
    }

    for (const c of legCoords) {
      coords.push(c);
    }
    distOffset += leg.distance_m;
  }

  const cumDist: number[] = [0];
  for (let i = 1; i < coords.length; i++) {
    const d = haversineM(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    cumDist.push(cumDist[i - 1] + d);
  }

  return {
    coords,
    cumDist,
    totalDist: cumDist[cumDist.length - 1] ?? 0,
    instructions,
  };
}

// ---------------------------------------------------------------------------
// Snap a GPS point to the nearest point on the route polyline
// ---------------------------------------------------------------------------

export interface SnappedPosition {
  lat: number;
  lng: number;
  segmentIndex: number;   // index of the segment start in coords[]
  distanceAlongRoute: number; // metres from route start
  distanceFromRoute: number;  // metres off the route (perpendicular)
}

function projectOnSegment(
  px: number, py: number, // point [lng, lat]
  ax: number, ay: number, // segment start [lng, lat]
  bx: number, by: number, // segment end [lng, lat]
): { t: number; lng: number; lat: number } {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq < 1e-14) return { t: 0, lng: ax, lat: ay };
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return { t, lng: ax + t * dx, lat: ay + t * dy };
}

export function snapToRoute(
  lat: number,
  lng: number,
  flat: FlatRoute,
): SnappedPosition {
  let bestDist = Infinity;
  let bestIdx = 0;
  let bestLng = flat.coords[0]?.[0] ?? lng;
  let bestLat = flat.coords[0]?.[1] ?? lat;
  let bestT = 0;

  for (let i = 0; i < flat.coords.length - 1; i++) {
    const [ax, ay] = flat.coords[i];
    const [bx, by] = flat.coords[i + 1];
    const proj = projectOnSegment(lng, lat, ax, ay, bx, by);
    const d = haversineM(lat, lng, proj.lat, proj.lng);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
      bestLng = proj.lng;
      bestLat = proj.lat;
      bestT = proj.t;
    }
  }

  const segLen = flat.cumDist[bestIdx + 1] - flat.cumDist[bestIdx];
  const distAlong = flat.cumDist[bestIdx] + bestT * segLen;

  return {
    lat: bestLat,
    lng: bestLng,
    segmentIndex: bestIdx,
    distanceAlongRoute: distAlong,
    distanceFromRoute: bestDist,
  };
}

// ---------------------------------------------------------------------------
// Find the next instruction ahead of the current position
// ---------------------------------------------------------------------------

export interface NextInstruction {
  instruction: Instruction;
  distanceTo: number; // metres until this instruction
}

export function findNextInstruction(
  distanceAlongRoute: number,
  instructions: Instruction[],
): NextInstruction | null {
  for (const inst of instructions) {
    if (inst.type === "depart") continue;
    if (inst.distance_m > distanceAlongRoute + 5) {
      return {
        instruction: inst,
        distanceTo: inst.distance_m - distanceAlongRoute,
      };
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Compute remaining distance, duration, ETA
// ---------------------------------------------------------------------------

export interface NavigationProgress {
  distanceRemaining: number;   // metres
  durationRemaining: number;   // seconds
  eta: Date;
  fraction: number;            // 0-1 progress along route
}

export function computeProgress(
  distanceAlongRoute: number,
  route: RouteOption,
  flat: FlatRoute,
): NavigationProgress {
  const remaining = Math.max(0, flat.totalDist - distanceAlongRoute);
  const fraction = flat.totalDist > 0 ? distanceAlongRoute / flat.totalDist : 0;
  const durationRemaining = route.total_duration_s * (1 - fraction);
  const eta = new Date(Date.now() + durationRemaining * 1000);

  return { distanceRemaining: remaining, durationRemaining, eta, fraction };
}

// ---------------------------------------------------------------------------
// Slice the route geometry into "completed" and "remaining" portions
// ---------------------------------------------------------------------------

export function splitRouteAtDistance(
  flat: FlatRoute,
  distanceAlongRoute: number,
): { completed: [number, number][]; remaining: [number, number][] } {
  if (flat.coords.length < 2) {
    return { completed: [], remaining: [...flat.coords] };
  }

  let splitIdx = 0;
  for (let i = 0; i < flat.cumDist.length; i++) {
    if (flat.cumDist[i] >= distanceAlongRoute) {
      splitIdx = i;
      break;
    }
    splitIdx = i;
  }

  // Interpolate the split point on the segment
  const segStart = flat.coords[splitIdx];
  let splitPoint: [number, number] = segStart;

  if (splitIdx < flat.coords.length - 1) {
    const segDist = flat.cumDist[splitIdx + 1] - flat.cumDist[splitIdx];
    if (segDist > 0) {
      const t = (distanceAlongRoute - flat.cumDist[splitIdx]) / segDist;
      const tClamped = Math.max(0, Math.min(1, t));
      const [ax, ay] = flat.coords[splitIdx];
      const [bx, by] = flat.coords[splitIdx + 1];
      splitPoint = [ax + tClamped * (bx - ax), ay + tClamped * (by - ay)];
    }
  }

  const completed = flat.coords.slice(0, splitIdx + 1).concat([splitPoint]);
  const remaining = [splitPoint].concat(flat.coords.slice(splitIdx + 1));

  return { completed, remaining };
}

// ---------------------------------------------------------------------------
// Off-route detection
// ---------------------------------------------------------------------------

const OFF_ROUTE_THRESHOLD_M = 50;

export function isOffRoute(distFromRoute: number): boolean {
  return distFromRoute > OFF_ROUTE_THRESHOLD_M;
}

// ---------------------------------------------------------------------------
// GPS smoothing (exponential moving average)
// ---------------------------------------------------------------------------

const EMA_ALPHA = 0.35; // weight of new reading (0 = full smooth, 1 = no smooth)
const JUMP_THRESHOLD_M = 80; // ignore GPS jumps larger than this

export interface SmoothedGps {
  lat: number;
  lng: number;
  speed: number | null;
}

export function smoothGps(
  raw: { lat: number; lng: number; speed: number | null },
  prev: SmoothedGps | null,
): SmoothedGps {
  if (!prev) return { lat: raw.lat, lng: raw.lng, speed: raw.speed };

  const jump = haversineM(prev.lat, prev.lng, raw.lat, raw.lng);
  if (jump > JUMP_THRESHOLD_M) return prev; // discard outlier

  return {
    lat: prev.lat + EMA_ALPHA * (raw.lat - prev.lat),
    lng: prev.lng + EMA_ALPHA * (raw.lng - prev.lng),
    speed: raw.speed,
  };
}

// ---------------------------------------------------------------------------
// Route bearing at a given distance along the route
// ---------------------------------------------------------------------------

export function routeBearingAt(flat: FlatRoute, distanceAlong: number): number {
  let idx = 0;
  for (let i = 0; i < flat.cumDist.length - 1; i++) {
    if (flat.cumDist[i + 1] >= distanceAlong) {
      idx = i;
      break;
    }
    idx = i;
  }
  const next = Math.min(idx + 1, flat.coords.length - 1);
  if (idx === next) return 0;
  const [aLng, aLat] = flat.coords[idx];
  const [bLng, bLat] = flat.coords[next];
  return bearing(aLat, aLng, bLat, bLng);
}
