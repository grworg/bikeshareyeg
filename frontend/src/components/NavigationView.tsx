"use client";

import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import { Map, Marker, Source, Layer } from "react-map-gl/maplibre";
import { X, Navigation, Compass, LocateFixed } from "lucide-react";
import type { RouteOption, InstructionType, GeocodedPlace } from "@/lib/types";
import { fmtDistance } from "@/lib/types";
import { MAP_STYLES, MODE_CONFIG } from "@/lib/constants";
import {
  flattenRoute,
  snapToRoute,
  findNextInstruction,
  computeProgress,
  splitRouteAtDistance,
  isOffRoute,
  smoothGps,
  routeBearingAt,
  type FlatRoute,
  type SnappedPosition,
  type NextInstruction,
  type NavigationProgress,
  type SmoothedGps,
} from "@/lib/routeUtils";
import "maplibre-gl/dist/maplibre-gl.css";

// ---------------------------------------------------------------------------
// Instruction icons (SVG paths for each turn type)
// ---------------------------------------------------------------------------

const INSTRUCTION_ICONS: Record<InstructionType, string> = {
  depart: "M12 2v14m0-14l-4 4m4-4l4 4",
  straight: "M12 2v20",
  left: "M15 6l-6 6 6 6",
  right: "M9 6l6 6-6 6",
  slight_left: "M17 4L7 14l6 0",
  slight_right: "M7 4l10 10-6 0",
  sharp_left: "M17 20L7 4l0 8",
  sharp_right: "M7 20L17 4l0 8",
  u_turn: "M9 20V8a4 4 0 018 0v1",
  arrive: "M12 22v-8m-4 4h8M12 2a3 3 0 100 6 3 3 0 000-6z",
};

const RECENTER_TIMEOUT_MS = 5000;
const ARRIVED_THRESHOLD_M = 30;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface NavigationViewProps {
  route: RouteOption;
  origin: GeocodedPlace | null;
  destination: GeocodedPlace | null;
  onExit: () => void;
}

export default function NavigationView({ route, origin, destination, onExit }: NavigationViewProps) {
  const mapRef = useRef<any>(null);

  const flat = useMemo(() => flattenRoute(route), [route]);
  const modeCfg = MODE_CONFIG[route.mode] || MODE_CONFIG.walk;
  const routeColor = modeCfg.color;

  // GPS + smoothing state
  const smoothedRef = useRef<SmoothedGps | null>(null);
  const [gpsPos, setGpsPos] = useState<SmoothedGps | null>(null);
  const [snapped, setSnapped] = useState<SnappedPosition | null>(null);
  const prevDistRef = useRef(0); // monotonic forward-only distance

  // Compass + route bearing
  const [compassHeading, setCompassHeading] = useState(0);
  const [routeHeading, setRouteHeading] = useState(0);
  const [headingUp, setHeadingUp] = useState(true);

  // Navigation state
  const [offRoute, setOffRoute] = useState(false);
  const [nextInst, setNextInst] = useState<NextInstruction | null>(null);
  const [progress, setProgress] = useState<NavigationProgress | null>(null);
  const [arrived, setArrived] = useState(false);

  // User interaction / auto-center pause
  const [userInteracting, setUserInteracting] = useState(false);
  const interactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const watchId = useRef<number | null>(null);
  const orientHandler = useRef<((e: DeviceOrientationEvent) => void) | null>(null);

  // ---------------------------------------------------------------------------
  // Start GPS + compass
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if ("geolocation" in navigator) {
      watchId.current = navigator.geolocation.watchPosition(
        (pos) => {
          const raw = { lat: pos.coords.latitude, lng: pos.coords.longitude, speed: pos.coords.speed };
          const smoothed = smoothGps(raw, smoothedRef.current);
          smoothedRef.current = smoothed;
          setGpsPos(smoothed);
        },
        () => {},
        { enableHighAccuracy: true, maximumAge: 2000, timeout: 10000 },
      );
    }

    const onOrientation = (e: DeviceOrientationEvent) => {
      const h = (e as any).webkitCompassHeading ?? (e.alpha != null ? (360 - e.alpha) % 360 : null);
      if (h != null) setCompassHeading(h);
    };
    orientHandler.current = onOrientation;

    const startCompass = async () => {
      const DOE = DeviceOrientationEvent as any;
      if (typeof DOE.requestPermission === "function") {
        try {
          const perm = await DOE.requestPermission();
          if (perm === "granted") window.addEventListener("deviceorientation", onOrientation, true);
        } catch { /* denied */ }
      } else {
        window.addEventListener("deviceorientation", onOrientation, true);
      }
    };
    startCompass();

    return () => {
      if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
      if (orientHandler.current) window.removeEventListener("deviceorientation", orientHandler.current, true);
      if (interactionTimer.current) clearTimeout(interactionTimer.current);
    };
  }, []);

  // ---------------------------------------------------------------------------
  // Update snapped position (forward-only), instructions, progress
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!gpsPos) return;
    const snap = snapToRoute(gpsPos.lat, gpsPos.lng, flat);

    // Forward-only: distance can only increase (small backward tolerance of 5m for GPS wobble)
    const clampedDist = Math.max(prevDistRef.current - 5, snap.distanceAlongRoute);
    if (clampedDist > prevDistRef.current) prevDistRef.current = clampedDist;

    const finalSnap: SnappedPosition = { ...snap, distanceAlongRoute: prevDistRef.current };
    setSnapped(finalSnap);
    setOffRoute(isOffRoute(snap.distanceFromRoute));
    setNextInst(findNextInstruction(prevDistRef.current, flat.instructions));
    setProgress(computeProgress(prevDistRef.current, route, flat));

    const rBearing = routeBearingAt(flat, prevDistRef.current);
    setRouteHeading(rBearing);
  }, [gpsPos, flat, route]);

  // ---------------------------------------------------------------------------
  // Auto-center map (paused when user interacts)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!snapped || !mapRef.current || userInteracting) return;
    const map = mapRef.current.getMap?.() ?? mapRef.current;
    if (!map) return;

    const mapBearing = headingUp ? routeHeading : 0;

    map.easeTo({
      center: [snapped.lng, snapped.lat],
      bearing: mapBearing,
      pitch: headingUp ? 55 : 0,
      zoom: headingUp ? 17.5 : 16,
      duration: 1000,
    });
  }, [snapped, routeHeading, headingUp, userInteracting]);

  // ---------------------------------------------------------------------------
  // Arrived detection
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!progress || arrived) return;
    if (progress.distanceRemaining < ARRIVED_THRESHOLD_M) {
      setArrived(true);
      try { navigator.vibrate?.([200, 100, 200]); } catch { /* */ }
      const t = setTimeout(onExit, 3500);
      return () => clearTimeout(t);
    }
  }, [progress, arrived, onExit]);

  // ---------------------------------------------------------------------------
  // User interaction handlers (pause auto-center on touch)
  // ---------------------------------------------------------------------------
  const handleTouchStart = useCallback(() => {
    setUserInteracting(true);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
    interactionTimer.current = setTimeout(() => setUserInteracting(false), RECENTER_TIMEOUT_MS);
  }, []);

  const handleRecenter = useCallback(() => {
    setUserInteracting(false);
    if (interactionTimer.current) clearTimeout(interactionTimer.current);
  }, []);

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

  // Destination coords for marker
  const destCoord = useMemo(() => {
    const lastCoord = flat.coords[flat.coords.length - 1];
    if (destination) return { lat: destination.lat, lng: destination.lng };
    if (lastCoord) return { lat: lastCoord[1], lng: lastCoord[0] };
    return null;
  }, [flat, destination]);

  // ---------------------------------------------------------------------------
  // Format helpers
  // ---------------------------------------------------------------------------
  const fmtETA = (d: Date) => d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const fmtSpeed = (ms: number | null) => {
    if (ms == null || ms < 0.3) return null;
    return `${(ms * 3.6).toFixed(0)}`;
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
  const fraction = progress?.fraction ?? 0;

  // Compute GPS dot rotation: use route bearing for heading cone
  const dotRotation = routeHeading;

  return (
    <div className="absolute inset-0 z-[60] bg-black flex flex-col">
      {/* ---- Top instruction bar ---- */}
      <div className="shrink-0 px-4 pb-3 pt-safe flex items-center gap-4" style={{ background: routeColor }}>
        <div className="w-14 h-14 flex items-center justify-center">
          <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
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
        <button onClick={onExit} className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
          <X size={20} className="text-white" />
        </button>
      </div>

      {/* ---- Map ---- */}
      <div
        className="flex-1 relative"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <Map
          ref={mapRef}
          initialViewState={{
            latitude: gpsPos?.lat ?? origin?.lat ?? 53.544,
            longitude: gpsPos?.lng ?? origin?.lng ?? -113.491,
            zoom: 17.5,
            pitch: 55,
            bearing: routeHeading,
          }}
          mapStyle={MAP_STYLES.streets}
          attributionControl={false}
          dragRotate={false}
          style={{ width: "100%", height: "100%" }}
        >
          {/* Completed portion (dimmed) */}
          <Source id="route-completed" type="geojson" data={completedGeoJSON as any}>
            <Layer
              id="route-completed-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": routeColor, "line-width": 8, "line-opacity": 0.25 }}
            />
          </Source>

          {/* Remaining portion (bold with casing) */}
          <Source id="route-remaining" type="geojson" data={remainingGeoJSON as any}>
            <Layer
              id="route-remaining-casing"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": "#000", "line-width": 14, "line-opacity": 0.12 }}
            />
            <Layer
              id="route-remaining-line"
              type="line"
              layout={{ "line-cap": "round", "line-join": "round" }}
              paint={{ "line-color": routeColor, "line-width": 8, "line-opacity": 1 }}
            />
          </Source>

          {/* GPS dot as map Marker (moves with map on pan/zoom) */}
          {snapped && (
            <Marker latitude={snapped.lat} longitude={snapped.lng} anchor="center">
              <div style={{ transform: `rotate(${dotRotation}deg)` }}>
                {/* Heading cone */}
                <div style={{
                  position: "absolute",
                  top: -18,
                  left: "50%",
                  marginLeft: -10,
                  width: 0,
                  height: 0,
                  borderLeft: "10px solid transparent",
                  borderRight: "10px solid transparent",
                  borderBottom: "24px solid rgba(66,133,244,0.25)",
                }} />
              </div>
              {/* Blue dot with white ring */}
              <div style={{ width: 22, height: 22, borderRadius: "50%", background: "#fff", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 1px 4px rgba(0,0,0,0.3)" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: "#4285f4" }} />
              </div>
            </Marker>
          )}

          {/* Destination pin */}
          {destCoord && (
            <Marker latitude={destCoord.lat} longitude={destCoord.lng} anchor="bottom">
              <svg width="28" height="36" viewBox="0 0 28 36" fill="none">
                <path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 22 14 22s14-11.5 14-22C28 6.27 21.73 0 14 0z" fill="#d32f2f" />
                <circle cx="14" cy="14" r="6" fill="white" />
              </svg>
            </Marker>
          )}
        </Map>

        {/* Off-route warning */}
        {offRoute && !arrived && (
          <div className="absolute top-4 left-4 right-4 z-20 bg-[#d32f2f] text-white text-[13px] font-medium px-4 py-2.5 rounded-xl text-center shadow-lg">
            You seem to be off the route
          </div>
        )}

        {/* Arrived overlay */}
        {arrived && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/40">
            <div className="bg-white rounded-2xl px-8 py-6 text-center shadow-xl">
              <div className="text-[20px] font-bold text-[var(--color-fg)] mb-1">You have arrived</div>
              <div className="text-[13px] text-[var(--color-secondary)]">
                {destination ? destination.label.split(",")[0] : "Destination"}
              </div>
            </div>
          </div>
        )}

        {/* Speed badge (bottom-left) */}
        {gpsPos?.speed != null && fmtSpeed(gpsPos.speed) && (
          <div className="absolute bottom-4 left-4 z-20 bg-white rounded-lg shadow-md w-14 h-14 flex flex-col items-center justify-center">
            <div className="text-[20px] font-bold text-[var(--color-fg)] leading-none">
              {fmtSpeed(gpsPos.speed)}
            </div>
            <div className="text-[9px] text-[var(--color-secondary)] mt-0.5">km/h</div>
          </div>
        )}

        {/* Re-center button (shown when user has panned away) */}
        {userInteracting && (
          <button
            onClick={handleRecenter}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 bg-white rounded-full shadow-md px-4 py-2 flex items-center gap-1.5 text-[13px] font-medium text-[#4285f4]"
          >
            <LocateFixed size={16} />
            Re-center
          </button>
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
      <div className="shrink-0 bg-[var(--color-surface)] relative">
        {/* Progress bar */}
        <div className="h-[3px] bg-[var(--color-border)]">
          <div
            className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${Math.min(fraction * 100, 100)}%`, backgroundColor: routeColor }}
          />
        </div>
        <div className="px-5 py-3 pb-safe flex items-center justify-between">
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
    </div>
  );
}
