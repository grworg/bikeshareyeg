import type { ReactNode } from "react";
import { Footprints, Bike, Bus, TrainFront } from "lucide-react";
import { createElement } from "react";
import { cityConfig } from "@/lib/cityConfig";

/** City center coordinates (from city config) */
export const CITY_CENTER = {
  latitude: cityConfig.center.lat,
  longitude: cityConfig.center.lng,
};

export const INITIAL_VIEW_STATE = {
  ...CITY_CENTER,
  zoom: cityConfig.initialZoom,
  pitch: 0,
  bearing: 0,
};

/**
 * Map styles — OpenFreeMap Liberty is the default (full OSM detail with
 * roads, buildings, POIs, landmarks — closest to Google Maps).
 */
export const MAP_STYLES = {
  streets: "https://tiles.openfreemap.org/styles/liberty",
  light: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
  satellite: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
} as const;

export type MapStyleKey = keyof typeof MAP_STYLES;

// ---------------------------------------------------------------------------
// Colors (Google Maps palette)
// ---------------------------------------------------------------------------

export const COLORS = {
  legWalk: [100, 100, 100] as [number, number, number],
  legBike: [52, 168, 83] as [number, number, number],
  legBikeShare: [26, 115, 232] as [number, number, number],
  legLRT: [123, 31, 162] as [number, number, number],
  legBus: [11, 128, 67] as [number, number, number],
  legWait: [180, 180, 180] as [number, number, number],
};

/** Route mode display config */
export const MODE_CONFIG: Record<
  string,
  { label: string; icon: ReactNode; color: string }
> = {
  walk: { label: "Walk", icon: createElement(Footprints, { size: 16 }), color: "#646464" },
  bike: { label: "Bike", icon: createElement(Bike, { size: 16 }), color: "#34a853" },
  bikeshare: { label: "Bike Share", icon: createElement(Bike, { size: 16 }), color: "#1a73e8" },
  transit: { label: "Transit", icon: createElement(Bus, { size: 16 }), color: "#0b8043" },
  transit_bike: { label: "Transit + Bike Share", icon: createElement(TrainFront, { size: 14, className: "inline mr-0.5" }), color: "#0b8043" },
};
