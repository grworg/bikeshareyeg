import type { BikeStation } from "@/lib/types";

export function stationHexColor(bikes: number, capacity: number): string {
  const pct = bikes / Math.max(capacity, 1);
  if (pct < 0.15 || pct > 0.85) return "#ea4335";
  if (pct < 0.3 || pct > 0.7) return "#fbbc04";
  return "#34a853";
}

export function stationRgba(bikes: number, capacity: number): [number, number, number, number] {
  const pct = bikes / Math.max(capacity, 1);
  if (pct < 0.15 || pct > 0.85) return [234, 67, 53, 230];
  if (pct < 0.3 || pct > 0.7) return [251, 188, 4, 230];
  return [52, 168, 83, 230];
}

export const FACTOR_COLORS: Record<string, string> = {
  lrt: "#7b1fa2",
  bike_infra: "#00838f",
  transit: "#0277bd",
  commercial: "#e65100",
  education: "#283593",
  recreation: "#2e7d32",
  population: "#e53935",
  hilliness: "#6d4c41",
};

export const PATHABLE_FACTORS = new Set(["lrt", "bike_infra", "transit", "commercial", "education", "recreation"]);

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16),
    parseInt(h.substring(2, 4), 16),
    parseInt(h.substring(4, 6), 16),
  ];
}
