/** Edmonton city center coordinates */
export const EDMONTON_CENTER = {
  latitude: 53.5461,
  longitude: -113.4937,
};

export const INITIAL_VIEW_STATE = {
  ...EDMONTON_CENTER,
  zoom: 11.5,
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
  // Route leg colors  [r, g, b]
  legWalk: [100, 100, 100] as [number, number, number],       // grey
  legBike: [52, 168, 83] as [number, number, number],         // green
  legBikeShare: [26, 115, 232] as [number, number, number],   // blue
  legLRT: [123, 31, 162] as [number, number, number],         // purple
  legBus: [11, 128, 67] as [number, number, number],          // dark green
  legWait: [180, 180, 180] as [number, number, number],       // light grey
};

/** Route mode display config */
export const MODE_CONFIG: Record<
  string,
  { label: string; icon: string; color: string }
> = {
  walk: { label: "Walk", icon: "🚶", color: "#646464" },
  bike: { label: "Bike", icon: "🚲", color: "#34a853" },
  bikeshare: { label: "Bike Share", icon: "🚲", color: "#1a73e8" },
  transit: { label: "Transit", icon: "🚍", color: "#0b8043" },
  transit_bike: { label: "Transit + Bike Share", icon: "🚍🚲", color: "#0b8043" },
};
