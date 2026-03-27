"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Map, Marker, NavigationControl, Source, Layer } from "react-map-gl/maplibre";
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
import {
  scoreHex,
  DEFAULT_DECAY_RADII,
  DEFAULT_DENSITY_SCALES,
  type ScorerParams,
  type HexScore,
} from "@/lib/suitability";
import { getHexPath } from "@/lib/api";
import { stationHexColor, stationRgba, FACTOR_COLORS, hexToRgb } from "@/components/map/helpers";
import { PinMarker, BikeStationIcon, TrainStationIcon, RichStationMarker } from "@/components/map/markers";
import { HexPopupContent, StationPopupContent } from "@/components/map/popups";
import MobileInfoCard from "@/components/MobileInfoCard";

// ---------------------------------------------------------------------------
// Exported types
// ---------------------------------------------------------------------------

export interface FlyToTarget {
  latitude: number;
  longitude: number;
  zoom: number;
  _ts: number;
  bounds?: [[number, number], [number, number]];
  padding?: number;
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
  onAddStationAt?: (lngLat: { lng: number; lat: number }) => void;
  designerMode?: boolean;
  isMobile?: boolean;
  selectedStationId?: string | null;
  onStationClick?: (stationId: string) => void;
  onDeleteStation?: (stationId: string) => void;
  onStationDragEnd?: (
    stationId: string,
    lngLat: { lng: number; lat: number },
  ) => void;
  overlayData?: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>;
  activeOverlays?: Set<OverlayKey>;
  suitabilityData?: GeoJSON.FeatureCollection | null;
  suitabilityWeights?: PlannerWeights | null;
  suitabilityDecayRadii?: PlannerDecayRadii | null;
  suitabilityDensityScales?: PlannerDensityScales | null;
  suitabilityConfig?: PlannerConfig | null;
  showSuitability?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

// ---------------------------------------------------------------------------
// Click-popup state (hex suitability or station info)
// ---------------------------------------------------------------------------

type PopupData =
  | { kind: "hex"; x: number; y: number; h3Id: string; score: HexScore; proxFactor: number }
  | { kind: "station"; x: number; y: number; station: BikeStation };




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
  onAddStationAt,
  designerMode = false,
  isMobile = false,
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
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
}: DeckMapProps) {
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW_STATE);
  const [mapStyle, setMapStyle] = useState<MapStyleKey>("streets");
  const lastFlyTs = useRef<number>(0);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [popup, setPopup] = useState<PopupData | null>(null);
  const [geolocating, setGeolocating] = useState(false);

  // Hex path exploration (Dijkstra visualization)
  const [hexPathData, setHexPathData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [hexPathLoading, setHexPathLoading] = useState<string | null>(null); // factor key being loaded

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

      let target = {
        latitude: flyTo.latitude,
        longitude: flyTo.longitude,
        zoom: flyTo.zoom,
      };

      if (flyTo.bounds && wrapperRef.current) {
        const rect = wrapperRef.current.getBoundingClientRect();
        const pad = flyTo.padding ?? 60;
        try {
          const vp = new WebMercatorViewport({
            width: rect.width,
            height: rect.height,
          }).fitBounds(flyTo.bounds, { padding: pad });
          target = { latitude: vp.latitude, longitude: vp.longitude, zoom: vp.zoom };
        } catch { /* fall through to explicit lat/lng/zoom */ }
      }

      setViewState((prev: any) => ({
        ...prev,
        ...target,
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

  // ---- Long-press for mobile station placement ----
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressCancelled = useRef(false);
  const longPressStartPos = useRef<{ x: number; y: number } | null>(null);
  const LONG_PRESS_MS = 500;
  const LONG_PRESS_MOVE_THRESHOLD = 10; // px — tolerate small finger drift
  const [longPressIndicator, setLongPressIndicator] = useState<{ x: number; y: number } | null>(null);
  const longPressIndicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);


  const cancelLongPress = useCallback(() => {
    longPressCancelled.current = true;
    longPressStartPos.current = null;
    setLongPressIndicator(null);
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
    if (longPressIndicatorTimer.current) {
      clearTimeout(longPressIndicatorTimer.current);
      longPressIndicatorTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!designerMode || !wrapperRef.current) return;
      const needsCallback = onAddStationAt || onRightClick;
      if (!needsCallback) return;
      if (e.touches.length !== 1) return;
      longPressCancelled.current = false;
      const touch = e.touches[0];
      const sx = touch.clientX;
      const sy = touch.clientY;
      longPressStartPos.current = { x: sx, y: sy };

      // Show visual indicator after 150ms of holding
      const rect = wrapperRef.current.getBoundingClientRect();
      longPressIndicatorTimer.current = setTimeout(() => {
        if (longPressCancelled.current) return;
        setLongPressIndicator({ x: sx - rect.left, y: sy - rect.top });
      }, 150);

      longPressTimer.current = setTimeout(() => {
        if (longPressCancelled.current) return;
        setLongPressIndicator(null);
        try {
          navigator.vibrate?.(50);
        } catch { /* not supported */ }
        try {
          const vp = new WebMercatorViewport({
            ...viewState,
            width: rect.width,
            height: rect.height,
          });
          const [lng, lat] = vp.unproject([sx - rect.left, sy - rect.top]);
          if (onAddStationAt) {
            onAddStationAt({ lng, lat });
          } else if (onRightClick) {
            onRightClick({ screenX: sx, screenY: sy, lng, lat });
          }
        } catch { /* ignore */ }
        longPressStartPos.current = null;
      }, LONG_PRESS_MS);
    },
    [viewState, onRightClick, onAddStationAt, designerMode],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!longPressStartPos.current) return;
      const touch = e.touches[0];
      const dx = touch.clientX - longPressStartPos.current.x;
      const dy = touch.clientY - longPressStartPos.current.y;
      if (Math.sqrt(dx * dx + dy * dy) > LONG_PRESS_MOVE_THRESHOLD) {
        cancelLongPress();
      }
    },
    [cancelLongPress],
  );

  const handleTouchEnd = useCallback(() => {
    // Only cancel if timer hasn't fired yet
    if (longPressTimer.current) cancelLongPress();
  }, [cancelLongPress]);

  // ---- FAB "place station" mode (mobile designer) ----
  const [fabPlaceMode, setFabPlaceMode] = useState(false);
  const [fabPlaceCount, setFabPlaceCount] = useState(0);

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
      const scorerParams: ScorerParams = {
        weights: { ..._sw },
        decayRadii: { ...DEFAULT_DECAY_RADII, ...suitabilityDecayRadii },
        densityScales: { ...DEFAULT_DENSITY_SCALES, ...suitabilityDensityScales },
        proximityFactors: proximityFactors ?? null,
      };

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
            if (p.routable === false) return [0, 0, 0, 0];

            const { overall: score } = scoreHex(p, scorerParams);

            if (score < 0.05) return [0, 0, 0, 0];
            if (score < 0.15) return [227, 242, 253, 60];
            if (score < 0.25) return [187, 222, 251, 90];
            if (score < 0.35) return [144, 202, 249, 110];
            if (score < 0.45) return [100, 181, 246, 130];
            if (score < 0.55) return [66, 165, 245, 145];
            if (score < 0.65) return [30, 136, 229, 155];
            if (score < 0.75) return [25, 118, 210, 165];
            if (score < 0.85) return [21, 101, 192, 175];
            return [13, 71, 161, 185];
          },
          pickable: true,
          parameters: { depthWriteEnabled: false },
          updateTriggers: {
            getFillColor: [
              _sw.population, _sw.lrt, _sw.bike_infra, _sw.transit,
              _sw.commercial, _sw.education, _sw.recreation,
              suitabilityDecayRadii, suitabilityDensityScales,
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

    // ── Accessibility overlay (non-routable hexes from suitability data) ──
    if (activeOverlays.has("accessibility") && suitabilityData) {
      const nonRoutable = {
        type: "FeatureCollection" as const,
        features: suitabilityData.features.filter(
          (f: any) => f.properties?.routable === false,
        ),
      };
      if (nonRoutable.features.length > 0) {
        result.push(
          new GeoJsonLayer({
            id: "overlay-accessibility",
            data: nonRoutable as any,
            stroked: true,
            filled: true,
            extruded: false,
            lineWidthMinPixels: 0.3,
            getLineColor: [120, 120, 120, 30] as [number, number, number, number],
            getLineWidth: 0.3,
            getFillColor: [178, 60, 60, 55] as [number, number, number, number],
            pickable: false,
            parameters: { depthWriteEnabled: false },
          }),
        );
      }
    }

    // ── Transit / cycling / road overlay line layers ──
    const overlayOrder: OverlayKey[] = ["motorway", "trunk", "bus", "bike", "lrt"];
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

    // ── Hex path visualization (Dijkstra route to nearest feature) ──
    if (hexPathData && hexPathData.features) {
      const pathFactor = (hexPathData as any)?.properties?.factor ?? "";
      const pathColor = FACTOR_COLORS[pathFactor] ?? "#1a73e8";
      const [r, g, b] = hexToRgb(pathColor);

      const routeFeatures = hexPathData.features.filter(
        (f: any) => f.properties?.type === "route",
      );
      const pointFeatures = hexPathData.features.filter(
        (f: any) => f.properties?.type === "destination" || f.properties?.type === "origin",
      );

      if (routeFeatures.length > 0) {
        result.push(
          new GeoJsonLayer({
            id: "hex-path-route",
            data: { type: "FeatureCollection", features: routeFeatures } as any,
            stroked: true,
            filled: false,
            lineWidthMinPixels: 4,
            getLineColor: [220, 40, 40, 230] as [number, number, number, number],
            getLineWidth: 4,
            getDashArray: [8, 4],
            dashJustified: true,
            pickable: false,
          }),
        );
      }
      if (pointFeatures.length > 0) {
        result.push(
          new ScatterplotLayer({
            id: "hex-path-points",
            data: pointFeatures.map((f: any) => ({
              position: f.geometry.coordinates,
              type: f.properties?.type,
              distance: f.properties?.distance_m,
            })),
            getPosition: (d: any) => d.position,
            getRadius: (d: any) => (d.type === "destination" ? 60 : 40),
            getFillColor: (d: any) =>
              d.type === "destination"
                ? [220, 40, 40, 220] as [number, number, number, number]
                : [66, 133, 244, 160] as [number, number, number, number],
            radiusMinPixels: 8,
            radiusMaxPixels: 16,
            pickable: false,
            stroked: true,
            getLineColor: [255, 255, 255, 220] as [number, number, number, number],
            lineWidthMinPixels: 2,
          }),
        );
      }
    }

    return result;
  }, [stations, selectedRoute, designerMode, selectedStationId, overlayData, activeOverlays, showSuitability, suitabilityData, suitabilityWeights, suitabilityDecayRadii, suitabilityDensityScales, proximityFactors, hexPathData]);

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

  // ---- Hex path fetch handler ----
  const handleFetchHexPath = useCallback(
    async (h3Id: string, factorKey: string) => {
      // Toggle off if same factor is already active
      if (hexPathData && hexPathLoading === null) {
        const activeFactor = (hexPathData as any)?.properties?.factor;
        const activeH3 = (hexPathData as any)?.properties?.h3;
        if (activeFactor === factorKey && activeH3 === h3Id) {
          setHexPathData(null);
          return;
        }
      }
      setHexPathLoading(factorKey);
      try {
        const data = await getHexPath(h3Id, factorKey);
        setHexPathData(data);
      } catch (err) {
        console.error("Failed to fetch hex path:", err);
        setHexPathData(null);
      } finally {
        setHexPathLoading(null);
      }
    },
    [hexPathData, hexPathLoading],
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
        const p = info.object.properties;
        const result = scoreHex(p, {
          weights: { ...(suitabilityWeights ?? {}) },
          decayRadii: { ...DEFAULT_DECAY_RADII, ...suitabilityDecayRadii },
          densityScales: { ...DEFAULT_DENSITY_SCALES, ...suitabilityDensityScales },
          proximityFactors: proximityFactors ?? null,
        });
        const pf = proximityFactors?.[p.h3] ?? 1.0;
        setPopup({ kind: "hex", x: sx, y: sy, h3Id: p.h3, score: result, proxFactor: pf });
        setHexPathData(null);
        setHexPathLoading(null);
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

      // Click on empty space → close popup + fire map click (or FAB place)
      setPopup(null);
      setHexPathData(null);
      setHexPathLoading(null);
      if (!info.object && info.coordinate) {
        if (fabPlaceMode && onAddStationAt) {
          onAddStationAt({ lng: info.coordinate[0], lat: info.coordinate[1] });
          setFabPlaceCount((c) => c + 1);
        } else if (fabPlaceMode && onRightClick) {
          const px = info.pixel?.[0] ?? 0;
          const py = info.pixel?.[1] ?? 0;
          const rect = wrapperRef.current?.getBoundingClientRect();
          onRightClick({
            screenX: (rect?.left ?? 0) + px,
            screenY: (rect?.top ?? 0) + py,
            lng: info.coordinate[0],
            lat: info.coordinate[1],
          });
          setFabPlaceMode(false);
        } else if (onMapClick) {
          onMapClick({ lng: info.coordinate[0], lat: info.coordinate[1] });
        }
      }
    },
    [onMapClick, onStationClick, onRightClick, onAddStationAt, designerMode, fabPlaceMode, suitabilityWeights, suitabilityDecayRadii, suitabilityDensityScales, proximityFactors],
  );

  return (
    <div
      ref={wrapperRef}
      className="relative w-full h-full"
      onContextMenu={handleContextMenu}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={cancelLongPress}
    >
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }: any) => {
          setViewState(vs);
          if (popup) {
            setPopup(null);
            // Don't clear hexPathData here — let users pan to see the full path
          }
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

          {/* ── Terrain hillshade (raster-dem from AWS Terrain Tiles) ── */}
          {activeOverlays.has("terrain") && (
            <Source
              id="terrain-dem"
              type="raster-dem"
              tiles={["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"]}
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              {...({ encoding: "terrarium" } as any)}
              tileSize={256}
              maxzoom={15}
            >
              <Layer
                id="terrain-hillshade"
                type="hillshade"
                paint={{
                  "hillshade-exaggeration": 0.5,
                  "hillshade-shadow-color": "#473B2B",
                  "hillshade-highlight-color": "#FAFAF8",
                  "hillshade-illumination-direction": 315,
                }}
              />
            </Source>
          )}

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
      {popup && !isMobile && (
        <div
          className="absolute z-50 pointer-events-auto"
          style={{ left: popup.x, top: popup.y, transform: "translate(-50%, -100%) translateY(-12px)" }}
        >
          <div
            className="bg-[var(--color-surface)] rounded-lg shadow-lg border border-[var(--color-border)] min-w-[180px] max-w-[260px] relative"
            style={{ fontFamily: "Roboto, sans-serif" }}
          >
            <button
              onClick={() => { setPopup(null); setHexPathData(null); setHexPathLoading(null); }}
              className="absolute top-1.5 right-1.5 w-5 h-5 flex items-center justify-center rounded-full text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-secondary)] transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="2" y1="2" x2="10" y2="10" />
                <line x1="10" y1="2" x2="2" y2="10" />
              </svg>
            </button>

            {popup.kind === "hex" ? (
              <HexPopupContent
                h3Id={popup.h3Id}
                score={popup.score}
                proxFactor={popup.proxFactor}
                activePathFactor={(hexPathData as any)?.properties?.factor ?? null}
                loadingFactor={hexPathLoading}
                onFactorClick={(factorKey) => handleFetchHexPath(popup.h3Id, factorKey)}
              />
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
          <div className="flex justify-center -mt-px">
            <div
              className="w-3 h-3 bg-[var(--color-surface)] border-r border-b border-[var(--color-border)]"
              style={{ transform: "rotate(45deg)", marginTop: -6 }}
            />
          </div>
        </div>
      )}

      {/* ── Mobile bottom card popup ── */}
      <MobileInfoCard
        open={!!popup && isMobile}
        onClose={() => { setPopup(null); setHexPathData(null); setHexPathLoading(null); }}
      >
        {popup?.kind === "hex" ? (
          <HexPopupContent
            h3Id={popup.h3Id}
            score={popup.score}
            proxFactor={popup.proxFactor}
            activePathFactor={(hexPathData as any)?.properties?.factor ?? null}
            loadingFactor={hexPathLoading}
            onFactorClick={(factorKey) => handleFetchHexPath(popup.h3Id, factorKey)}
          />
        ) : popup?.kind === "station" ? (
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
        ) : null}
      </MobileInfoCard>

      {/* Map controls: mobile centers style + locate in one bar; desktop keeps them in corners */}
      {isMobile ? (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex items-center gap-1 bg-[var(--color-surface)] rounded-lg p-1 shadow-[var(--shadow-md)]">
          {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((style) => (
            <button
              key={style}
              onClick={() => setMapStyle(style)}
              className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                mapStyle === style
                  ? "bg-[var(--color-active-bg)] text-[var(--color-blue)]"
                  : "text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              {style === "streets" ? "Map" : style === "light" ? "Light" : "Satellite"}
            </button>
          ))}
          <div className="w-px h-5 bg-[var(--color-border)] mx-0.5" />
          <button
            onClick={() => {
              if (!navigator.geolocation || geolocating) return;
              setGeolocating(true);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setViewState((prev: any) => ({
                    ...prev,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    zoom: 14,
                    transitionDuration: 1200,
                    transitionInterpolator: new FlyToInterpolator(),
                  }));
                  setGeolocating(false);
                },
                () => setGeolocating(false),
                { enableHighAccuracy: true, timeout: 8000 },
              );
            }}
            className="w-8 h-8 rounded-md flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors"
            aria-label="Center on my location"
          >
            {geolocating ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2">
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-5.07-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14 2.83 2.83m4.48 4.48 2.83 2.83"/>
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
              </svg>
            )}
          </button>
        </div>
      ) : (
        <>
          <button
            onClick={() => {
              if (!navigator.geolocation || geolocating) return;
              setGeolocating(true);
              navigator.geolocation.getCurrentPosition(
                (pos) => {
                  setViewState((prev: any) => ({
                    ...prev,
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                    zoom: 14,
                    transitionDuration: 1200,
                    transitionInterpolator: new FlyToInterpolator(),
                  }));
                  setGeolocating(false);
                },
                () => setGeolocating(false),
                { enableHighAccuracy: true, timeout: 8000 },
              );
            }}
            className="absolute bottom-6 right-4 z-20 w-10 h-10 bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-md)] flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors"
            aria-label="Center on my location"
            title="My location"
          >
            {geolocating ? (
              <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2">
                <path d="M12 2v4m0 12v4m10-10h-4M6 12H2m15.07-5.07-2.83 2.83M9.76 14.24l-2.83 2.83m0-10.14 2.83 2.83m4.48 4.48 2.83 2.83"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2"/>
              </svg>
            )}
          </button>
          <div className="absolute bottom-6 left-4 flex gap-1 bg-[var(--color-surface)] rounded-lg p-1 shadow-[var(--shadow-md)]">
            {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((style) => (
              <button
                key={style}
                onClick={() => setMapStyle(style)}
                className={`px-3 py-1.5 text-[12px] font-medium rounded-md transition-colors ${
                  mapStyle === style
                    ? "bg-[var(--color-active-bg)] text-[var(--color-blue)]"
                    : "text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                {style === "streets" ? "Map" : style === "light" ? "Light" : "Satellite"}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Designer mode indicator */}
      {designerMode && !fabPlaceMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[var(--color-blue)] text-white text-[12px] font-medium px-4 py-1.5 rounded-full shadow-[var(--shadow-md)] flex items-center gap-2 pointer-events-none whitespace-nowrap">
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
          {isMobile ? "Long-press to add stations" : "Designer Mode — Right-click to add stations"}
        </div>
      )}

      {/* Long-press visual indicator */}
      {longPressIndicator && (
        <div
          className="absolute z-40 pointer-events-none"
          style={{ left: longPressIndicator.x, top: longPressIndicator.y }}
        >
          <div className="w-12 h-12 -ml-6 -mt-6 rounded-full border-2 border-[var(--color-blue)] opacity-60 animate-ping" />
          <div className="w-6 h-6 -ml-3 -mt-9 rounded-full bg-[var(--color-blue)]/20" />
        </div>
      )}

      {/* Mobile designer floating controls */}
      {designerMode && isMobile && (
        <>
          {/* Undo / Redo buttons */}
          <div className="absolute bottom-20 left-4 z-30 flex flex-col gap-2">
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className="w-10 h-10 rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-md)] flex items-center justify-center transition-colors disabled:opacity-30"
              aria-label="Undo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className="w-10 h-10 rounded-full bg-[var(--color-surface)] shadow-[var(--shadow-md)] flex items-center justify-center transition-colors disabled:opacity-30"
              aria-label="Redo"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.13-9.36L23 10" />
              </svg>
            </button>
          </div>

          {/* FAB — place station button */}
          <button
            onClick={() => {
              setFabPlaceMode((p) => {
                if (!p) setFabPlaceCount(0);
                return !p;
              });
            }}
            className={`absolute bottom-20 right-4 z-30 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-all ${
              fabPlaceMode
                ? "bg-[var(--color-green)] text-white scale-110 ring-4 ring-[var(--color-green)]/30"
                : "bg-[var(--color-blue)] text-white"
            }`}
            aria-label={fabPlaceMode ? "Done placing stations" : "Add station"}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              {fabPlaceMode ? (
                <><polyline points="20 6 9 17 4 12" /></>
              ) : (
                <><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></>
              )}
            </svg>
            {fabPlaceMode && fabPlaceCount > 0 && (
              <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white text-[var(--color-green)] text-[11px] font-bold flex items-center justify-center shadow-sm">
                {fabPlaceCount}
              </span>
            )}
          </button>
        </>
      )}
      {fabPlaceMode && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 bg-[var(--color-green)] text-white text-[12px] font-medium px-4 py-1.5 rounded-full shadow-[var(--shadow-md)] pointer-events-none z-30 animate-pulse">
          Tap the map to place stations
        </div>
      )}
    </div>
  );
}
