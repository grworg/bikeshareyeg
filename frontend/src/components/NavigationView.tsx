"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Map, Source, Layer } from "react-map-gl/maplibre";
import { X, Navigation, Compass, Volume2, VolumeX } from "lucide-react";
import type { RouteOption, InstructionType, GeocodedPlace } from "@/lib/types";
import { fmtDistance } from "@/lib/types";
import { MAP_STYLES, COLORS, MODE_CONFIG } from "@/lib/constants";
import {
  flattenRoute,
  snapToRoute,
  findNextInstruction,
  computeProgress,
  splitRouteAtDistance,
  isOffRoute,
  bearing as calcBearing,
  type FlatRoute,
  type SnappedPosition,
  type NextInstruction,
  type NavigationProgress,
} from "@/lib/routeUtils";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------------------------------------------------------------------
// Instruction icons (SVG paths for each turn type)
// ---------------------------------------------------------------------------

const INSTRUCTION_ICONS: Record<InstructionType, string> = {
  depart: "M12 2v14m0-14l-4 4m4-4l4 4",       // arrow up
  straight: "M12 2v20",                          // straight
  left: "M15 6l-6 6 6 6",                        // arrow left
  right: "M9 6l6 6-6 6",                         // arrow right
  slight_left: "M17 4L7 14l6 0",                 // angled left
  slight_right: "M7 4l10 10-6 0",                // angled right
  sharp_left: "M17 20L7 4l0 8",                  // sharp left
  sharp_right: "M7 20L17 4l0 8",                 // sharp right
  u_turn: "M9 20V8a4 4 0 018 0v1",              // u-turn
  arrive: "M12 22v-8m-4 4h8M12 2a3 3 0 100 6 3 3 0 000-6z", // pin
};

// ---------------------------------------------------------------------------
// Component props
// ---------------------------------------------------------------------------

interface NavigationViewProps {
  route: RouteOption;
  origin: GeocodedPlace | null;
  destination: GeocodedPlace | null;
  onExit: () => void;
}

// ---------------------------------------------------------------------------
// Navigation View
// ---------------------------------------------------------------------------

export default function NavigationView({ route, origin, destination, onExit }: NavigationViewProps) {
  const mapRef = useRef<any>(null);

  // Flatten route once
  const flat = useMemo(() => flattenRoute(route), [route]);
  const modeCfg = MODE_CONFIG[route.mode] || MODE_CONFIG.walk;

  // GPS state
  const [gpsPos, setGpsPos] = useState<{ lat: number; lng: number; speed: number | null; accuracy: number } | null>(null);
  const [snapped, setSnapped] = useState<SnappedPosition | null>(null);
  const [heading, setHeading] = useState<number>(0);
  const [headingUp, setHeadingUp] = useState(true);
  const [offRoute, setOffRoute] = useState(false);

  // Nav progress
  const [nextInst, setNextInst] = useState<NextInstruction | null>(null);
  const [progress, setProgress] = useState<NavigationProgress | null>(null);

  const watchId = useRef<number | null>(null);
  const orientHandler = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  // ---------------------------------------------------------------------------
  // Request iOS compass permission & start GPS
  // ---------------------------------------------------------------------------
  useEffect(() => {
    // GPS
    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          setGpsPos({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            speed: pos.coords.speed,
            accuracy: pos.coords.accuracy,
          });
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
      );
    }

    // Compass
    const onOrientation = (e: DeviceOrientationEvent) => {
      // webkitCompassHeading for iOS, alpha for Android
      const h = (e as any).webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
      if (h != null) setHeading(h);
    };
    orientHandler.current = onOrientation;

    const startCompass = async () => {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        try {
          const perm = await DOE.requestPermission();
          if (perm === "granted") {
            window.addEventListener("deviceorientation", onOrientation, true);
          }
        } catch { /* user denied */ }
      } else {
        window.addEventListener("deviceorientation", onOrientation, true);
      }
    };
    startCompass();

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (orientHandler.current) {
        window.removeEventListener("deviceorientation", orientHandler.current, true);
      }
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Update snapped position, instructions, progress when GPS changes
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!gpsPos) return;
    const snap = snapToRoute(gpsPos.lat, gpsPos.lng, flat);
    setSnapped(snap);
    setOffRoute(isOffRoute(snap.distanceFromRoute));
    setNextInst(findNextInstruction(snap.distanceAlongRoute, flat.instructions));
    setProgress(computeProgress(snap.distanceAlongRoute, route, flat));
  }, [gpsPos, flat, route]);

  // ---------------------------------------------------------------------------
  // Center map on GPS position + heading
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!gpsPos || !mapRef.current) return;
    const map = mapRef.current.getMap?.() ?? mapRef.current;
    if (!map) return;

    map.easeTo({
      center: [gpsPos.lng, gpsPos.lat],
      bearing: headingUp ? heading : 0,
      pitch: headingUp ? 55 : 0,
      zoom: 17,
      duration: 600,
    });
  }, [gpsPos, heading, headingUp]);

  // ---------------------------------------------------------------------------
  // Route GeoJSON layers
  // ---------------------------------------------------------------------------
  const { completedGeoJSON, remainingGeoJSON } = useMemo(() => {
    const dist = snapped?.distanceAlongRoute ?? 0;
    const { completed, remaining } = splitRouteAtDistance(flat, dist);
    return {
      completedGeoJSON: {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: completed },
      },
      remainingGeoJSON: {
        type: "Feature" as const,
        properties: {},
        geometry: { type: "LineString" as const, coordinates: remaining },
      },
    };
  }, [flat, snapped]);

  // ---------------------------------------------------------------------------
  // Format helpers
  // ---------------------------------------------------------------------------
  const fmtETA = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const fmtSpeed = (ms: number | null) => {
    if (ms == null || ms < 0.3) return null;
    return `${(ms * 3.6).toFixed(0)} km/h`;
  };
  const fmtTimeRemaining = (s: number) => {
    const mins = Math.ceil(s / 60);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  };

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const instructionIcon = nextInst?.instruction.type ?? "straight";
  const routeColor = modeCfg.color;

  return (
    <div className="absolute inset-0 z-[60] bg-black flex flex-col">
      {/* ---- Top instruction bar ---- */}
      <div
        className="shrink-0 px-4 pb-3 pt-safe flex items-center gap-4"
        style={{ background: routeColor }}
      >
        <div className="w-14 h-14 flex items-center justify-center">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d={INSTRUCTION_ICONS[instructionIcon]} />
          </svg>
        </div>
        <div className="flex-1 min-w-0">
          {nextInst ? (
            <>
              <div className="text-white text-[24px] font-bold leading-tight">
                {fmtDistance(nextInst.distanceTo)}
              </div>
              <div className="text-white/80 text-[14px] truncate">
                {nextInst.instruction.text}
              </div>
            </>
          ) : (
            <>
              <div className="text-white text-[20px] font-bold leading-tight">
                {progress?.distanceRemaining != null ? fmtDistance(progress.distanceRemaining) : ""}
              </div>
              <div className="text-white/80 text-[14px]">Follow the route</div>
            </>
          )}
        </div>
        <button
          onClick={onExit}
          className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center"
        >
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* ---- Map ---- */}
      <div className="flex-1 relative">
        <Map
          ref={mapRef}
          initialViewState={{
            latitude: gpsPos?.lat ?? origin?.lat ?? 53.544,
            longitude: gpsPos?.lng ?? origin?.lng ?? -113.491,
            zoom: 17,
            pitch: 55,
            bearing: heading,
          }}
          mapStyle={MAP_STYLES.streets}
          attributionControl={false}
          dragRotate={false}
          touchZoomRotate={false}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Completed portion (dimmed) */}
          <Source id="route-completed" type="geojson" data={completedGeoJSON as any}>
            <Layer
              id="route-completed-line"
              type="line"
              paint={{
                "line-color": routeColor,
                "line-width": 6,
                "line-opacity": 0.3,
              }}
            />
          </Source>

          {/* Remaining portion (bold) */}
          <Source id="route-remaining" type="geojson" data={remainingGeoJSON as any}>
            <Layer
              id="route-remaining-casing"
              type="line"
              paint={{
                "line-color": "#000",
                "line-width": 10,
                "line-opacity": 0.15,
              }}
            />
            <Layer
              id="route-remaining-line"
              type="line"
              paint={{
                "line-color": routeColor,
                "line-width": 6,
                "line-opacity": 1,
              }}
            />
          </Source>
        </Map>

        {/* GPS dot overlay */}
        {gpsPos && (
          <div
            className="absolute pointer-events-none z-10"
            style={{
              top: "50%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          >
            {/* Heading cone */}
            <div
              className="absolute -top-5 left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: "8px solid transparent",
                borderRight: "8px solid transparent",
                borderBottom: "20px solid rgba(66,133,244,0.3)",
                transform: "rotate(0deg)",
              }}
            />
            {/* Outer ring */}
            <div className="w-6 h-6 rounded-full bg-white shadow-lg flex items-center justify-center">
              <div className="w-4 h-4 rounded-full bg-[#4285f4]" />
            </div>
          </div>
        )}

        {/* Off-route warning */}
        {offRoute && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-[#d32f2f] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl text-center shadow-lg">
            You seem to be off the route
          </div>
        )}

        {/* Speed badge (bottom-left) */}
        {gpsPos?.speed != null && fmtSpeed(gpsPos.speed) && (
          <div className="absolute bottom-4 left-4 z-20 bg-white rounded-lg shadow-md px-3 py-1.5">
            <div className="text-[18px] font-bold text-[var(--color-fg)] leading-tight">
              {fmtSpeed(gpsPos.speed)}
            </div>
          </div>
        )}

        {/* Compass button (bottom-right) */}
        <button
          onClick={() => setHeadingUp((h) => !h)}
          className="absolute bottom-4 right-4 z-20 w-11 h-11 bg-white rounded-full shadow-md flex items-center justify-center"
        >
          {headingUp ? (
            <Compass size={20} className="text-[#4285f4]" />
          ) : (
            <Navigation size={20} className="text-[var(--color-secondary)]" />
          )}
        </button>
      </div>

      {/* ---- Bottom status bar ---- */}
      <div className="shrink-0 bg-[var(--color-surface)] px-5 py-3 pb-safe flex items-center justify-between">
        <div>
          <div className="text-[22px] font-bold text-[var(--color-fg)]">
            {progress ? fmtTimeRemaining(progress.durationRemaining) : "--"}
          </div>
          <div className="text-[12px] text-[var(--color-secondary)]">
            {progress ? fmtDistance(progress.distanceRemaining) : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="text-[16px] font-semibold text-[var(--color-fg)]">
            {progress ? fmtETA(progress.eta) : "--:--"}
          </div>
          <div className="text-[12px] text-[var(--color-secondary)]">ETA</div>
        </div>
        <button
          onClick={onExit}
          className="ml-4 px-5 py-2 rounded-full bg-[#d32f2f] text-white text-[14px] font-medium shadow-sm"
        >
          Exit
        </button>
      </div>
    </div>
  );
}
