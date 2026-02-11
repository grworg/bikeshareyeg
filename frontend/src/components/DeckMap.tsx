"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, NavigationControl } from "react-map-gl/maplibre";
import DeckGL from "@deck.gl/react";
import { FlyToInterpolator, WebMercatorViewport } from "@deck.gl/core";
import { GeoJsonLayer, ScatterplotLayer } from "@deck.gl/layers";
import {
  INITIAL_VIEW_STATE,
  MAP_STYLES,
  COLORS,
  type MapStyleKey,
} from "@/lib/constants";
import type { BikeStation, RouteOption, LatLng, OverlayKey, PlannerWeights, PlannerDecayRadii, PlannerDensityScales, PlannerConfig } from "@/lib/types";
import {
  OVERLAY_COLORS,
  OVERLAY_WIDTHS,
} from "@/components/OverlayControls";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface FlyToTarget {
  latitude: number;
  longitude: number;
  zoom: number;
  _ts: number;
}

interface DeckMapProps {
  stations: BikeStation[];
  origin: LatLng | null;
  destination: LatLng | null;
  selectedRoute: RouteOption | null;
  flyTo: FlyToTarget | null;
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onRightClick?: (info: {
    screenX: number;
    screenY: number;
    lng: number;
    lat: number;
  }) => void;
  designerMode?: boolean;
  selectedStationId?: string | null;
  onStationClick?: (stationId: string) => void;
  onDeleteStation?: (stationId: string) => void;
  onStationDragEnd?: (
    stationId: string,
    lngLat: { lng: number; lat: number },
  ) => void;
  overlayData?: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>;
  activeOverlays?: Set<OverlayKey>;
  // Suitability hex grid (planner)
  suitabilityData?: GeoJSON.FeatureCollection | null;
  suitabilityWeights?: PlannerWeights | null;
  suitabilityDecayRadii?: PlannerDecayRadii | null;
  suitabilityDensityScales?: PlannerDensityScales | null;
  suitabilityConfig?: PlannerConfig | null;
  showSuitability?: boolean;
}

// ---------------------------------------------------------------------------
// Click-popup state (hex suitability or station info)
// ---------------------------------------------------------------------------

type PopupData =
  | { kind: "hex"; x: number; y: number; html: string }
  | { kind: "station"; x: number; y: number; station: BikeStation };

// ---------------------------------------------------------------------------
// Icon: Google Maps teardrop pin (origin / destination)
// ---------------------------------------------------------------------------

function PinMarker({ color, size = 40 }: { color: string; size?: number }) {
  const w = Math.round(size * (24 / 36));
  return (
    <svg
      width={w}
      height={size}
      viewBox="0 0 24 36"
      fill="none"
      style={{ filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}
    >
      <path
        d="M12 0C5.372 0 0 5.372 0 12c0 9 12 24 12 24s12-15 12-24C24 5.372 18.628 0 12 0z"
        fill={color}
      />
      <circle cx="12" cy="12" r="4.5" fill="white" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Availability color helper — green / yellow / red based on fill ratio
// ---------------------------------------------------------------------------

function stationHexColor(bikes: number, capacity: number): string {
  const pct = bikes / Math.max(capacity, 1);
  if (pct < 0.15 || pct > 0.85) return "#ea4335"; // red – danger
  if (pct < 0.3 || pct > 0.7) return "#fbbc04"; // yellow – warning
  return "#34a853"; // green – balanced
}

/** RGBA tuple for deck.gl layers — avoids hex→rgba parse per frame. */
function stationRgba(bikes: number, capacity: number): [number, number, number, number] {
  const pct = bikes / Math.max(capacity, 1);
  if (pct < 0.15 || pct > 0.85) return [234, 67, 53, 230];
  if (pct < 0.3 || pct > 0.7) return [251, 188, 4, 230];
  return [52, 168, 83, 230];
}

// ---------------------------------------------------------------------------
// Icon: Bike station marker (colored circle with white bike silhouette)
// ---------------------------------------------------------------------------

function BikeStationIcon({
  size = 24,
  selected = false,
  color = "#34a853",
  onClick,
  title,
}: {
  size?: number;
  selected?: boolean;
  color?: string;
  onClick?: () => void;
  title?: string;
}) {
  return (
    <div
      onClick={
        onClick
          ? (e) => {
              e.stopPropagation();
              onClick();
            }
          : undefined
      }
      title={title}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: color,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: selected ? "3px solid #1a73e8" : "2px solid white",
        boxShadow: selected
          ? "0 0 0 3px rgba(26,115,232,0.3), 0 2px 4px rgba(0,0,0,0.3)"
          : "0 1px 3px rgba(0,0,0,0.3)",
        cursor: onClick ? "grab" : "pointer",
        transition: "box-shadow 0.15s, border 0.15s, background-color 0.2s",
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="5.5" cy="17" r="3.5" />
        <circle cx="18.5" cy="17" r="3.5" />
        <path d="M15 6a1 1 0 100-2 1 1 0 000 2z" fill="white" stroke="none" />
        <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icon: LRT train station marker (purple circle with white train)
// ---------------------------------------------------------------------------

function TrainStationIcon({ size = 22 }: { size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        backgroundColor: "#7b1fa2",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        border: "2px solid white",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      <svg
        width={size * 0.55}
        height={size * 0.55}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect x="4" y="3" width="16" height="13" rx="2" fill="white" fillOpacity="0.2" />
        <line x1="4" y1="11" x2="20" y2="11" />
        <circle cx="8.5" cy="13.5" r="1" fill="white" stroke="none" />
        <circle cx="15.5" cy="13.5" r="1" fill="white" stroke="none" />
        <path d="M9 16l-2 5M15 16l2 5" />
        <line x1="6" y1="21" x2="18" y2="21" />
      </svg>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dock grid — visual representation of bike slots (for rich markers)
// ---------------------------------------------------------------------------

/** Tiny bike icon for dock grid — shows a filled bike or empty outline */
function MicroBike({ filled, color }: { filled: boolean; color: string }) {
  return (
    <svg
      width="10"
      height="9"
      viewBox="0 0 24 24"
      fill="none"
      stroke={filled ? color : "#d0d0d0"}
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block" }}
    >
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
    </svg>
  );
}

function DockGrid({ bikes, capacity }: { bikes: number; capacity: number }) {
  const cols = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(capacity * 1.5))));
  const docks: boolean[] = [];
  for (let i = 0; i < capacity; i++) docks.push(i < bikes);
  const color = stationHexColor(bikes, capacity);

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gap: "1px",
        padding: "3px 0 1px",
      }}
    >
      {docks.map((filled, i) => (
        <MicroBike key={i} filled={filled} color={color} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rich station marker — shown at high zoom in designer mode
// ---------------------------------------------------------------------------

function RichStationMarker({
  station,
  isSelected,
  onClick,
}: {
  station: BikeStation;
  isSelected: boolean;
  onClick: () => void;
}) {
  const pct = station.bikes / Math.max(station.capacity, 1);
  const color = stationHexColor(station.bikes, station.capacity);

  return (
    <div
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      style={{
        backgroundColor: "white",
        borderRadius: 8,
        padding: "6px 10px 5px",
        borderLeft: `3px solid ${color}`,
        boxShadow: isSelected
          ? "0 0 0 2px #1a73e8, 0 2px 8px rgba(0,0,0,0.25)"
          : "0 1px 4px rgba(0,0,0,0.3)",
        cursor: "grab",
        minWidth: 72,
        maxWidth: 160,
        transition: "box-shadow 0.15s",
        userSelect: "none" as const,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginBottom: 2,
        }}
      >
        {/* Tiny bike icon */}
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke={color}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="5.5" cy="17" r="3.5" />
          <circle cx="18.5" cy="17" r="3.5" />
          <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
        </svg>
        <span
          style={{
            fontSize: 11,
            fontWeight: 500,
            color: "#202124",
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
            maxWidth: 120,
            lineHeight: "14px",
          }}
        >
          {station.name}
        </span>
      </div>
      <DockGrid bikes={station.bikes} capacity={station.capacity} />
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 4,
          marginTop: 2,
        }}
      >
        <div
          style={{
            flex: 1,
            height: 3,
            borderRadius: 1.5,
            background: "#e0e0e0",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct * 100}%`,
              background: color,
              borderRadius: 1.5,
              transition: "width 0.2s",
            }}
          />
        </div>
        <span
          style={{
            fontSize: 10,
            color: "#5f6368",
            whiteSpace: "nowrap",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {station.bikes}/{station.capacity}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Station popup card (shown on click)
// ---------------------------------------------------------------------------

function StationPopupContent({
  station,
  designerMode,
  onDelete,
}: {
  station: BikeStation;
  designerMode: boolean;
  onDelete?: () => void;
}) {
  const pct = station.bikes / Math.max(station.capacity, 1);
  const color = stationHexColor(station.bikes, station.capacity);

  return (
    <div className="px-3.5 py-3">
      <div className="flex items-center gap-2 mb-2 pr-5">
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        >
          <circle cx="5.5" cy="17" r="3.5" />
          <circle cx="18.5" cy="17" r="3.5" />
          <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
        </svg>
        <span className="text-[13px] font-medium text-[#202124] truncate">
          {station.name}
        </span>
      </div>
      {/* Stats */}
      <div className="flex items-center gap-3 text-[11px] text-[#5f6368] mb-2">
        <span>{station.bikes} bikes</span>
        <span>{station.capacity - station.bikes} docks free</span>
        <span>{station.capacity} total</span>
      </div>
      {/* Fill bar */}
      <div className="h-[4px] rounded-full bg-[#e0e0e0] overflow-hidden mb-2">
        <div
          className="h-full rounded-full transition-[width] duration-200"
          style={{ width: `${pct * 100}%`, backgroundColor: color }}
        />
      </div>
      <div className="text-[10px] text-[#9aa0a6] mb-1">
        ID: {station.id}
      </div>
      {/* Delete button (designer mode only) */}
      {onDelete && (
        <button
          onClick={onDelete}
          className="mt-1 w-full text-[12px] font-medium text-[#d32f2f] bg-[#fde7e7] hover:bg-[#fbc8c8] rounded-md py-1.5 transition-colors"
        >
          Delete Station
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DeckMap({
  stations,
  origin,
  destination,
  selectedRoute,
  flyTo,
  onMapClick,
  onRightClick,
  designerMode = false,
  selectedStationId,
  onStationClick,
  onDeleteStation,
  onStationDragEnd,
  overlayData = {},
  activeOverlays = new Set(),
  suitabilityData = null,
  suitabilityWeights = null,
  suitabilityDecayRadii = null,
  suitabilityDensityScales = null,
  suitabilityConfig = null,
  showSuitability = false,
}: DeckMapProps) {
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("streets");
  const lastFlyTs = useRef<number>(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupData | null>(null);

  const currentZoom = viewState.zoom ?? INITIAL_VIEW_STATE.zoom;
  const showRichMarkers = designerMode && currentZoom >= 15;

  // ---- Proximity discount map: per-hex multiplier based on distance to stations ----
  const proximityFactors = useMemo(() => {
    if (!showSuitability || !suitabilityData || stations.length === 0 || !suitabilityConfig) {
      return null;
    }
    const discountRadius = suitabilityConfig.proximityDiscountRadius;
    const discountStrength = suitabilityConfig.proximityDiscountStrength / 100;
    const connRadius = suitabilityConfig.connectivityRadius;
    const connStrength = suitabilityConfig.connectivityStrength / 100;

    // Need at least one effect active
    const hasDiscount = discountRadius > 0 && discountStrength > 0;
    const hasConnectivity = connRadius > 0 && connStrength > 0;
    if (!hasDiscount && !hasConnectivity) return null;

    const LAT_M = 111320;
    const LNG_M = 111320 * Math.cos(53.5 * Math.PI / 180);
    const result: Record<string, number> = {};

    for (const feat of suitabilityData.features) {
      const h3id = (feat.properties as any)?.h3;
      if (!h3id) continue;
      const ring = (feat.geometry as any).coordinates[0] as number[][];
      const n = ring.length - 1;
      let clat = 0, clng = 0;
      for (let j = 0; j < n; j++) { clat += ring[j][1]; clng += ring[j][0]; }
      clat /= n;
      clng /= n;

      // Find distance to nearest station
      let minDist = Infinity;
      for (const s of stations) {
        const d = Math.sqrt(
          ((clat - s.lat) * LAT_M) ** 2 + ((clng - s.lng) * LNG_M) ** 2,
        );
        if (d < minDist) minDist = d;
      }

      let factor = 1.0;

      // Proximity discount: too close → penalty (linear ramp up to 1.0)
      if (hasDiscount && minDist < discountRadius) {
        factor *= 1.0 - discountStrength * (1.0 - minDist / discountRadius);
      }

      // Connectivity penalty: too far → penalty (linear ramp down from 1.0)
      if (hasConnectivity && minDist > connRadius) {
        // Beyond connectivity radius, linearly decay to (1-strength) at 2× radius
        const excess = minDist - connRadius;
        const decay = Math.min(excess / connRadius, 1.0); // 0→1 over one additional radius
        factor *= 1.0 - connStrength * decay;
      }

      result[h3id] = factor;
    }
    return result;
  }, [showSuitability, suitabilityData, stations, suitabilityConfig]);

  // ---- Extract LRT station points for custom icon rendering ----
  const lrtStationPoints = useMemo(() => {
    const data = overlayData.lrt;
    if (!data || !activeOverlays.has("lrt")) return [];
    return data.features.filter(
      (f) => f.geometry.type === "Point",
    ) as GeoJSON.Feature<GeoJSON.Point>[];
  }, [overlayData, activeOverlays]);

  // ---- Fly-to animation ----
  useEffect(() => {
    if (flyTo && flyTo._ts !== lastFlyTs.current) {
      lastFlyTs.current = flyTo._ts;
      setViewState((prev: any) => ({
        ...prev,
        latitude: flyTo.latitude,
        longitude: flyTo.longitude,
        zoom: flyTo.zoom,
        pitch: 0,
        bearing: 0,
        transitionDuration: 1200,
        transitionInterpolator: new FlyToInterpolator(),
      }));
    }
  }, [flyTo]);

  // ---- Context menu (right-click) ----
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      if (!onRightClick || !wrapperRef.current) return;

      const rect = wrapperRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      try {
        const vp = new WebMercatorViewport({
          ...viewState,
          width: rect.width,
          height: rect.height,
        });
        const [lng, lat] = vp.unproject([x, y]);
        onRightClick({ screenX: e.clientX, screenY: e.clientY, lng, lat });
      } catch {
        /* ignore */
      }
    },
    [viewState, onRightClick],
  );

  // ---- deck.gl layers ----
  const layers = useMemo(() => {
    const result: any[] = [];

    // ── Population density choropleth (rendered first = underneath everything) ──
    if (activeOverlays.has("population") && overlayData.population) {
      result.push(
        new GeoJsonLayer({
          id: "overlay-population",
          data: overlayData.population as any,
          stroked: true,
          filled: true,
          extruded: false,
          lineWidthMinPixels: 0.5,
          getLineColor: [100, 100, 100, 80] as [number, number, number, number],
          getLineWidth: 0.5,
          getFillColor: (f: any) => {
            const d: number = f.properties?.density ?? 0;
            // 12-stop color scale: light yellow → orange → red → dark magenta
            if (d < 250)  return [255, 249, 196, 60];    // very pale yellow
            if (d < 500)  return [255, 245, 157, 80];    // light yellow
            if (d < 1000) return [255, 236, 111, 100];   // yellow
            if (d < 1500) return [255, 213, 79, 115];    // amber
            if (d < 2000) return [255, 183, 40, 130];    // light orange
            if (d < 2500) return [255, 152, 0, 140];     // orange
            if (d < 3000) return [251, 120, 19, 150];    // deep orange
            if (d < 4000) return [244, 81, 30, 155];     // dark orange
            if (d < 5000) return [229, 57, 53, 160];     // red
            if (d < 7000) return [211, 47, 47, 168];     // dark red
            if (d < 9000) return [173, 20, 87, 175];     // magenta
            return [136, 14, 79, 185];                    // dark magenta
          },
          pickable: true,
          parameters: { depthWriteEnabled: false },
          updateTriggers: {
            getFillColor: [overlayData.population],
          },
        }),
      );
    }

    // ── Suitability hex grid (planner) ──
    if (showSuitability && suitabilityData && suitabilityWeights) {
      const _sw = suitabilityWeights;
      const _dr = suitabilityDecayRadii;
      const _ds = suitabilityDensityScales;

      // Proximity-scored factors (linear decay from nearest)
      const PROXIMITY_KEYS = ["lrt", "bike_infra", "transit"] as const;
      const DEFAULT_RADII: Record<string, number> = { lrt: 2000, bike_infra: 200, transit: 800 };

      // Density-scored factors (POI count, log normalization)
      const DENSITY_KEYS = ["commercial", "education", "recreation"] as const;
      const DEFAULT_SCALES: Record<string, number> = { commercial: 30, education: 5, recreation: 8 };

      // Normalised weights (0-1) for each factor
      const wMap: Record<string, number> = {};
      let wTotal = 0;
      for (const key of Object.keys(_sw) as (keyof typeof _sw)[]) {
        const w = _sw[key] / 100;
        wMap[key] = w;
        wTotal += w;
      }
      if (wTotal === 0) wTotal = 1;

      // Resolved decay radii (proximity factors only)
      const drMap: Record<string, number> = {};
      for (const key of PROXIMITY_KEYS) {
        drMap[key] = _dr?.[key as keyof typeof _dr] ?? DEFAULT_RADII[key] ?? 1000;
      }

      // Resolved density scales (POI factors)
      const dsMap: Record<string, number> = {};
      for (const key of DENSITY_KEYS) {
        dsMap[key] = _ds?.[key as keyof typeof _ds] ?? DEFAULT_SCALES[key] ?? 10;
      }

      const _proxFactors = proximityFactors; // capture for closure

      result.push(
        new GeoJsonLayer({
          id: "suitability-hexgrid",
          data: suitabilityData as any,
          stroked: true,
          filled: true,
          extruded: false,
          lineWidthMinPixels: 0.5,
          getLineColor: [80, 80, 80, 40] as [number, number, number, number],
          getLineWidth: 0.5,
          getFillColor: (f: any) => {
            const p = f.properties || {};
            let score = 0;
            for (const key of Object.keys(wMap)) {
              const w = wMap[key];
              if (w === 0) continue;

              let factorScore: number;
              const countKey = `${key}_count`;
              const distKey = `${key}_dist`;

              if (countKey in p && key in dsMap) {
                // Density-scored factor: log normalization of POI count
                const count: number = p[countKey];
                const scale = dsMap[key];
                factorScore = Math.min(1, Math.log1p(count) / Math.log1p(scale));
              } else if (distKey in p && key in drMap) {
                // Proximity-scored factor: linear decay from nearest
                factorScore = Math.max(0, 1 - p[distKey] / drMap[key]);
              } else {
                // Direct score (e.g. population)
                factorScore = p[key] ?? 0;
              }
              score += w * factorScore;
            }
            score /= wTotal;

            // Apply proximity discount from nearby existing stations
            if (_proxFactors && p.h3) {
              score *= _proxFactors[p.h3] ?? 1.0;
            }

            // 0 → transparent, 1 → vivid blue
            if (score < 0.05) return [0, 0, 0, 0]; // invisible
            if (score < 0.15) return [227, 242, 253, 60];   // very light blue
            if (score < 0.25) return [187, 222, 251, 90];   // light blue
            if (score < 0.35) return [144, 202, 249, 110];  // sky
            if (score < 0.45) return [100, 181, 246, 130];  // medium blue
            if (score < 0.55) return [66, 165, 245, 145];   // blue
            if (score < 0.65) return [30, 136, 229, 155];   // strong blue
            if (score < 0.75) return [25, 118, 210, 165];   // dark blue
            if (score < 0.85) return [21, 101, 192, 175];   // deeper blue
            return [13, 71, 161, 185];                        // navy
          },
          pickable: true,
          parameters: { depthWriteEnabled: false },
          updateTriggers: {
            getFillColor: [
              _sw.population, _sw.lrt, _sw.bike_infra, _sw.transit,
              _sw.commercial, _sw.education, _sw.recreation,
              drMap.lrt, drMap.bike_infra, drMap.transit,
              dsMap.commercial, dsMap.education, dsMap.recreation,
              proximityFactors,
            ],
          },
        }),
      );
    }

    // ── POI overlay point layers (rendered as small dots) ──
    const poiOverlays: OverlayKey[] = ["commercial", "education", "recreation"];
    for (const key of poiOverlays) {
      if (activeOverlays.has(key) && overlayData[key]) {
        result.push(
          new ScatterplotLayer({
            id: `overlay-${key}`,
            data: (overlayData[key] as GeoJSON.FeatureCollection).features.filter(
              (f): f is GeoJSON.Feature<GeoJSON.Point> => f.geometry.type === "Point",
            ),
            getPosition: (f: GeoJSON.Feature<GeoJSON.Point>) => f.geometry.coordinates as [number, number],
            getFillColor: OVERLAY_COLORS[key],
            getRadius: 4,
            radiusMinPixels: 3,
            radiusMaxPixels: 8,
            pickable: true,
            parameters: { depthWriteEnabled: false },
          }),
        );
      }
    }

    // ── Transit / cycling overlay line layers ──
    const overlayOrder: OverlayKey[] = ["bus", "bike", "lrt"];
    for (const key of overlayOrder) {
      if (activeOverlays.has(key) && overlayData[key]) {
        // For LRT, filter out Point features (rendered as HTML Markers below)
        const data =
          key === "lrt"
            ? {
                ...overlayData[key]!,
                features: overlayData[key]!.features.filter(
                  (f) => f.geometry.type !== "Point",
                ),
              }
            : overlayData[key];

        result.push(
          new GeoJsonLayer({
            id: `overlay-${key}`,
            data: data as any,
            stroked: true,
            filled: false,
            lineWidthMinPixels: OVERLAY_WIDTHS[key],
            getLineColor: OVERLAY_COLORS[key],
            getLineWidth: OVERLAY_WIDTHS[key],
            pickable: true,
            parameters: { depthWriteEnabled: false },
          }),
        );
      }
    }

    // ── Station dots (GPU-rendered ScatterplotLayer) ──
    if (activeOverlays.has("docks") && stations.length > 0) {
      // In designer mode, exclude the selected station (rendered as draggable HTML Marker)
      const dotData =
        designerMode && selectedStationId
          ? stations.filter((s) => s.id !== selectedStationId)
          : stations;

      if (dotData.length > 0) {
        result.push(
          new ScatterplotLayer({
            id: "station-dots",
            data: dotData,
            getPosition: (d: BikeStation) => [d.lng, d.lat],
            getFillColor: (d: BikeStation) => stationRgba(d.bikes, d.capacity),
            getRadius: 6,
            radiusMinPixels: designerMode ? 10 : 8,
            radiusMaxPixels: 20,
            stroked: true,
            getLineColor: [255, 255, 255, 230] as [number, number, number, number],
            lineWidthMinPixels: 2,
            pickable: true,
            updateTriggers: {
              getFillColor: [stations],
            },
          }),
        );
      }
    }

    // ── Route polyline (routing mode only) ──
    if (!designerMode && selectedRoute) {
      selectedRoute.legs.forEach((leg, i) => {
        if (leg.mode === "wait") return; // skip rendering wait legs as lines

        let color: [number, number, number, number];
        if (leg.mode === "walk") {
          color = [...COLORS.legWalk, 200] as [number, number, number, number];
        } else if (leg.mode === "lrt") {
          color = [...COLORS.legLRT, 230] as [number, number, number, number];
        } else if (leg.mode === "bus") {
          color = [...COLORS.legBus, 220] as [number, number, number, number];
        } else if (leg.mode === "bike" && (selectedRoute.mode === "bikeshare" || selectedRoute.mode === "transit_bike")) {
          color = [...COLORS.legBikeShare, 220] as [number, number, number, number];
        } else {
          color = [...COLORS.legBike, 220] as [number, number, number, number];
        }

        const width = leg.mode === "walk" ? 3 : (leg.mode === "lrt" || leg.mode === "bus") ? 5 : 5;

        result.push(
          new GeoJsonLayer({
            id: `route-leg-${i}`,
            data: {
              type: "Feature",
              geometry: leg.geometry,
              properties: { mode: leg.mode },
            } as any,
            stroked: true,
            filled: false,
            lineWidthMinPixels: width,
            getLineColor: color,
            getLineWidth: width,
            pickable: false,
            ...(leg.mode === "lrt" ? { getDashArray: [8, 4], dashJustified: true, extensions: [] } : {}),
            ...(leg.mode === "bus" ? { getDashArray: [4, 3], dashJustified: true, extensions: [] } : {}),
          }),
        );
      });

      if (selectedRoute.pickup_station && selectedRoute.dropoff_station) {
        result.push(
          new ScatterplotLayer({
            id: "route-stations",
            data: [selectedRoute.pickup_station, selectedRoute.dropoff_station],
            getPosition: (d: any) => [d.lng, d.lat],
            getRadius: 80,
            getFillColor: [26, 115, 232, 40] as [number, number, number, number],
            radiusMinPixels: 16,
            radiusMaxPixels: 24,
            pickable: false,
            stroked: true,
            getLineColor: [26, 115, 232, 200] as [number, number, number, number],
            lineWidthMinPixels: 2,
          }),
        );
      }
    }

    return result;
  }, [stations, selectedRoute, designerMode, selectedStationId, overlayData, activeOverlays, showSuitability, suitabilityData, suitabilityWeights, suitabilityDecayRadii, suitabilityDensityScales, proximityFactors]);

  // ---- Hover tooltip (overlays only — hex & station popups are click-based) ----
  const getTooltip = useCallback(
    (info: any) => {
      if (!info.object) return null;

      // Overlay feature tooltip (hover)
      if (info.object.properties && info.layer?.id?.startsWith("overlay-")) {
        const props = info.object.properties;

        // Population density tooltip
        if (info.layer.id === "overlay-population") {
          const name = props.name || (props.dauid ? `DA ${props.dauid}` : "Unknown");
          const pop = props.population != null ? Number(props.population).toLocaleString() : "N/A";
          const density = props.density != null ? Math.round(props.density).toLocaleString() : "N/A";
          const area = props.area_km2 != null ? Number(props.area_km2).toFixed(props.area_km2 < 1 ? 3 : 1) : "N/A";
          return {
            html: `<div style="font-family:Roboto,sans-serif">
                     <div style="font-size:13px;font-weight:600;margin-bottom:4px">${name}</div>
                     <div style="font-size:11px;color:#5f6368;line-height:1.6">
                       Population: <b style="color:#202124">${pop}</b><br/>
                       Density: <b style="color:#202124">${density}/km²</b><br/>
                       Area: ${area} km²
                     </div>
                   </div>`,
            style: {
              backgroundColor: "#fff",
              color: "#202124",
              borderRadius: "8px",
              padding: "10px 14px",
              boxShadow: "0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)",
              border: "none",
            },
          };
        }

        // POI overlay tooltips — show name + category
        const poiLayers = ["overlay-commercial", "overlay-education", "overlay-recreation"];
        if (poiLayers.includes(info.layer.id)) {
          const name = props.name || "";
          const category = props.shop || props.amenity || props.leisure || "";
          const label = name || (category ? category.replace(/_/g, " ") : info.layer.id.replace("overlay-", ""));
          const subtitle = name && category ? category.replace(/_/g, " ") : props.layer || "";
          return {
            html: `<div style="font-family:Roboto,sans-serif;font-size:13px;font-weight:500">${label}</div>
                   ${subtitle ? `<div style="font-size:11px;color:#5f6368;margin-top:2px;text-transform:capitalize">${subtitle}</div>` : ""}`,
            style: {
              backgroundColor: "#fff",
              color: "#202124",
              borderRadius: "8px",
              padding: "8px 12px",
              boxShadow: "0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)",
              border: "none",
            },
          };
        }

        const name = props.name || props.ref || "";
        const layerType = props.layer || "";
        if (!name) return null;
        return {
          html: `<div style="font-family:Roboto,sans-serif;font-size:13px;font-weight:500">${name}</div>
                 <div style="font-size:11px;color:#5f6368;margin-top:2px;text-transform:capitalize">${layerType}</div>`,
          style: {
            backgroundColor: "#fff",
            color: "#202124",
            borderRadius: "8px",
            padding: "8px 12px",
            boxShadow:
              "0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)",
            border: "none",
          },
        };
      }

      // Station hover: show name only (details on click)
      if (info.object && info.layer?.id === "station-dots") {
        return {
          html: `<div style="font-family:Roboto,sans-serif;font-size:12px;font-weight:500">${info.object.name}</div>`,
          style: {
            backgroundColor: "#fff",
            color: "#202124",
            borderRadius: "6px",
            padding: "5px 10px",
            boxShadow: "0 1px 3px 0 rgba(60,64,67,0.3), 0 4px 8px 3px rgba(60,64,67,0.15)",
            border: "none",
          },
        };
      }

      return null;
    },
    [],
  );

  // ---- Build hex popup HTML (used by click handler) ----
  const buildHexPopupHtml = useCallback(
    (properties: any): string => {
      const p = properties;
      const _sw = suitabilityWeights;
      const _dr = suitabilityDecayRadii;
      const _ds = suitabilityDensityScales;
      const DEFAULT_RADII: Record<string, number> = { lrt: 2000, bike_infra: 200, transit: 800 };
      const DEFAULT_SCALES: Record<string, number> = { commercial: 30, education: 5, recreation: 8 };
      const FACTOR_LABELS: Record<string, string> = {
        population: "Population",
        commercial: "Commercial",
        education: "Education",
        recreation: "Recreation",
        lrt: "LRT",
        bike_infra: "Bike infra",
        transit: "Transit",
      };

      // Compute per-factor scores and weighted total
      let wTotal = 0;
      let rawScore = 0;
      const factorScores: Record<string, number> = {};
      const factorExtras: Record<string, string> = {};

      for (const key of Object.keys(FACTOR_LABELS)) {
        const w = (_sw?.[key as keyof typeof _sw] ?? 0) / 100;
        wTotal += w;
        const countKey = `${key}_count`;
        const distKey = `${key}_dist`;
        let fs: number;

        if (countKey in p && key in DEFAULT_SCALES) {
          // Density-scored factor
          const count: number = p[countKey];
          const scale = _ds?.[key as keyof typeof _ds] ?? DEFAULT_SCALES[key];
          fs = Math.min(1, Math.log1p(count) / Math.log1p(scale));
          factorExtras[key] = `${count} nearby`;
        } else if (distKey in p && key in DEFAULT_RADII) {
          // Proximity-scored factor
          const dr = _dr?.[key as keyof typeof _dr] ?? DEFAULT_RADII[key];
          fs = dr ? Math.max(0, 1 - p[distKey] / dr) : 0;
          factorExtras[key] = `${Math.round(p[distKey])}m`;
        } else {
          fs = p[key] ?? 0;
        }
        factorScores[key] = fs;
        rawScore += w * fs;
      }
      if (wTotal === 0) wTotal = 1;
      rawScore /= wTotal;

      const proxFactor = proximityFactors?.[p.h3] ?? 1.0;
      const adjustedScore = rawScore * proxFactor;
      const pct = (n: number) => Math.round(n * 100);
      const proxLine = proxFactor < 0.99
        ? `<br/>Station modifier: <b style="color:${proxFactor < 0.7 ? '#e53935' : '#fb8c00'}">×${proxFactor.toFixed(2)}</b>`
        : "";
      const lines = Object.entries(FACTOR_LABELS)
        .map(([key, label]) => {
          const extra = factorExtras[key] ? ` <span style="color:#9e9e9e">(${factorExtras[key]})</span>` : "";
          return `${label}: ${pct(factorScores[key])}%${extra}`;
        })
        .join("<br/>");
      return `<div style="font-size:13px;font-weight:600;margin-bottom:4px">Suitability: ${pct(adjustedScore)}%</div>
              <div style="font-size:11px;color:#5f6368;line-height:1.6">
                ${lines}${proxLine}
              </div>`;
    },
    [suitabilityWeights, suitabilityDecayRadii, suitabilityDensityScales, proximityFactors],
  );

  // ---- Click handler (left-button only) ----
  const handleClick = useCallback(
    (info: any) => {
      // Ignore right-clicks — they're handled by the contextmenu event
      if (info.srcEvent && (info.srcEvent as MouseEvent).button !== 0) return;

      const sx = info.pixel?.[0] ?? info.x ?? 0;
      const sy = info.pixel?.[1] ?? info.y ?? 0;

      // Suitability hex click → popup
      if (
        info.object &&
        info.layer?.id === "suitability-hexgrid" &&
        info.object.properties
      ) {
        setPopup({
          kind: "hex",
          x: sx,
          y: sy,
          html: buildHexPopupHtml(info.object.properties),
        });
        return;
      }

      // Station dot click → popup (and select in designer mode)
      if (info.object && info.layer?.id === "station-dots") {
        if (designerMode && onStationClick) {
          onStationClick(info.object.id);
        }
        setPopup({
          kind: "station",
          x: sx,
          y: sy,
          station: info.object as BikeStation,
        });
        return;
      }

      // Click on empty space → close popup + fire map click
      setPopup(null);
      if (!info.object && info.coordinate && onMapClick) {
        onMapClick({ lng: info.coordinate[0], lat: info.coordinate[1] });
      }
    },
    [onMapClick, onStationClick, designerMode, buildHexPopupHtml],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full"
      onContextMenu={handleContextMenu}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }: any) => {
          setViewState(vs);
          if (popup) setPopup(null);
        }}
        controller={true}
        layers={layers}
        getTooltip={getTooltip}
        onClick={handleClick}
        getCursor={({ isDragging, isHovering }: any) => {
          if (isDragging) return "grabbing";
          if (isHovering) return "pointer";
          if (designerMode) return "default";
          return onMapClick ? "crosshair" : "grab";
        }}
      >
        <Map
          mapStyle={MAP_STYLES[mapStyle]}
          style={{ width: "100%", height: "100%" }}
        >
          <NavigationControl position="bottom-right" showCompass={false} />

          {/* ── LRT station icons (train markers) ── */}
          {lrtStationPoints.map((f, i) => {
            const [lng, lat] = (f.geometry as GeoJSON.Point).coordinates;
            const name = f.properties?.name || "";
            return (
              <Marker
                key={`lrt-${f.properties?.id ?? i}`}
                latitude={lat}
                longitude={lng}
                anchor="center"
              >
                <div title={name ? `${name} (LRT)` : "LRT Station"}>
                  <TrainStationIcon size={22} />
                </div>
              </Marker>
            );
          })}

          {/* ── Designer mode: single HTML Marker for the selected station (draggable) ──
               All other stations are rendered via the GPU ScatterplotLayer above. */}
          {designerMode &&
            activeOverlays.has("docks") &&
            selectedStationId &&
            (() => {
              const sel = stations.find((s) => s.id === selectedStationId);
              if (!sel) return null;
              return (
                <Marker
                  key={sel.id}
                  latitude={sel.lat}
                  longitude={sel.lng}
                  anchor="center"
                  draggable
                  onDragEnd={(e) =>
                    onStationDragEnd?.(sel.id, {
                      lng: e.lngLat.lng,
                      lat: e.lngLat.lat,
                    })
                  }
                >
                  {showRichMarkers ? (
                    <RichStationMarker
                      station={sel}
                      isSelected={true}
                      onClick={() => {}}
                    />
                  ) : (
                    <BikeStationIcon
                      size={28}
                      selected={true}
                      color={stationHexColor(sel.bikes, sel.capacity)}
                      title={`${sel.name}\n${sel.bikes}/${sel.capacity} bikes`}
                    />
                  )}
                </Marker>
              );
            })()}

          {/* ── Routing mode: origin/destination pins ── */}
          {!designerMode && origin && (
            <Marker
              latitude={origin.lat}
              longitude={origin.lng}
              anchor="bottom"
            >
              <PinMarker color="#1a73e8" size={44} />
            </Marker>
          )}
          {!designerMode && destination && (
            <Marker
              latitude={destination.lat}
              longitude={destination.lng}
              anchor="bottom"
            >
              <PinMarker color="#ea4335" size={44} />
            </Marker>
          )}
        </Map>
      </DeckGL>

      {/* ── Click popup (hex suitability or station info) ── */}
      {popup && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={{ left: popup.x, top: popup.y, transform: "translate(-50%, -100%) translateY(-12px)" }}
        >
          <div
            className="bg-white rounded-lg shadow-lg border border-[#e0e0e0] min-w-[180px] max-w-[260px] relative"
            style={{ fontFamily: "Roboto, sans-serif" }}
          >
            {/* Close button */}
            <button
              onClick={() => setPopup(null)}
              className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-[#9aa0a6] hover:bg-[#f1f3f4] hover:text-[#5f6368] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>

            {popup.kind === "hex" ? (
              <div className="px-3.5 py-3" dangerouslySetInnerHTML={{ __html: popup.html }} />
            ) : (
              <StationPopupContent
                station={popup.station}
                designerMode={designerMode}
                onDelete={
                  designerMode && onDeleteStation
                    ? () => {
                        onDeleteStation(popup.station.id);
                        setPopup(null);
                      }
                    : undefined
                }
              />
            )}
          </div>
          {/* Arrow */}
          <div className="flex justify-center -mt-px">
            <div
              className="w-3 h-3 bg-white border-r border-b border-[#e0e0e0]"
              style={{ transform: "rotate(45deg)", marginTop: -6 }}
            />
          </div>
        </div>
      )}

      {/* Map style switcher */}
      <div className="absolute bottom-6 left-4 flex gap-1 bg-white rounded-lg p-1 shadow-[var(--shadow-md)]">
        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((style) => (
          <button
            key={style}
            onClick={() => setMapStyle(style)}
            className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
              mapStyle === style
                ? "bg-[#e8f0fe] text-[var(--color-blue)]"
                : "text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {style === "streets"
              ? "Map"
              : style === "light"
                ? "Light"
                : "Satellite"}
          </button>
        ))}
      </div>

      {/* Designer mode indicator */}
      {designerMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[var(--color-blue)] text-white text-[12px] font-medium px-4 py-1.5 rounded-full shadow-[var(--shadow-md)] flex items-center gap-2 pointer-events-none">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M12 20h9M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
          Designer Mode — Right-click to add stations
        </div>
      )}
    </div>
  );
}
