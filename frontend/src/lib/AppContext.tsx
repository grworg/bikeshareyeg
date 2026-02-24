"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { usePathname } from "next/navigation";
import type {
  AppMode,
  GeocodedPlace,
  RouteOption,
  LatLng,
  OverlayKey,
} from "@/lib/types";
import type { ContextMenuState } from "@/components/ContextMenu";
import type { ModalState } from "@/components/Modal";
import type { FlyToTarget } from "@/components/DeckMap";
import {
  computeRoutes,
  reverseGeocode,
  getOverlay,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Map callback registration — pages set these on mount
// ---------------------------------------------------------------------------

export interface MapCallbacks {
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onRightClick?: (info: { screenX: number; screenY: number; lng: number; lat: number }) => void;
}

// ---------------------------------------------------------------------------
// Zoom-for-bounds helper
// ---------------------------------------------------------------------------

function zoomForBounds(p1: LatLng, p2: LatLng): number {
  const latSpan = Math.abs(p1.lat - p2.lat);
  const lngSpan = Math.abs(p1.lng - p2.lng);
  const span = Math.max(latSpan, lngSpan * 0.59);
  if (span > 0.25) return 10.5;
  if (span > 0.12) return 11.5;
  if (span > 0.06) return 12.5;
  if (span > 0.03) return 13.5;
  if (span > 0.015) return 14.5;
  return 15;
}

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

export interface AppContextValue {
  // Navigation (derived from URL pathname)
  mode: AppMode;

  // Map
  flyTo: FlyToTarget | null;
  setFlyTo: (t: FlyToTarget | null) => void;
  mapCallbacks: MapCallbacks;
  registerMapCallbacks: (cbs: MapCallbacks | null) => void;

  // Selection
  selectedStationId: string | null;
  setSelectedStationId: (id: string | null) => void;
  autoFocusName: boolean;
  setAutoFocusName: (v: boolean) => void;
  contextMenu: ContextMenuState | null;
  setContextMenu: (m: ContextMenuState | null) => void;

  // Modal
  modal: ModalState;
  setModal: (m: ModalState) => void;
  closeModal: () => void;

  // Overlays
  activeOverlays: Set<OverlayKey>;
  setActiveOverlays: React.Dispatch<React.SetStateAction<Set<OverlayKey>>>;
  overlayData: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>;
  loadingOverlays: Set<OverlayKey>;
  toggleOverlay: (key: OverlayKey) => void;

  // Routing
  origin: GeocodedPlace | null;
  destination: GeocodedPlace | null;
  setOrigin: (p: GeocodedPlace | null) => void;
  setDestination: (p: GeocodedPlace | null) => void;
  routes: RouteOption[];
  routeNotices: string[];
  selectedRouteIndex: number | null;
  setSelectedRouteIndex: (i: number | null) => void;
  isLoadingRoutes: boolean;
  departureTime: string | null;
  setDepartureTime: (t: string | null) => void;
  getDirections: () => void;
  selectedRoute: RouteOption | null;
  originLatLng: LatLng | null;
  destLatLng: LatLng | null;

  // Preview stations (build history hover)
  previewStations: import("@/lib/types").BikeStation[] | null;
  setPreviewStations: (s: import("@/lib/types").BikeStation[] | null) => void;
}

const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Derive mode from pathname
// ---------------------------------------------------------------------------

function modeFromPathname(pathname: string): AppMode {
  if (pathname.startsWith("/designer")) return "designer";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/docs")) return "docs";
  return "routing";
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AppProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const mode = modeFromPathname(pathname);

  // ---- Map ----
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  const [mapCallbacks, setMapCallbacks] = useState<MapCallbacks>({});

  const registerMapCallbacks = useCallback((cbs: MapCallbacks | null) => {
    setMapCallbacks(cbs ?? {});
  }, []);

  // ---- Selection ----
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [autoFocusName, setAutoFocusName] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  // Clear selection on mode change
  const prevModeRef = useRef<AppMode>(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      setSelectedStationId(null);
      setContextMenu(null);
      prevModeRef.current = mode;
    }
  }, [mode]);

  // ---- Preview stations (build history hover) ----
  const [previewStations, setPreviewStations] = useState<import("@/lib/types").BikeStation[] | null>(null);

  // ---- Modal ----
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = useCallback(() => setModal(null), []);

  // ---- Overlays ----
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(
    () => new Set<OverlayKey>(["lrt", "bike", "docks"]),
  );
  const [overlayData, setOverlayData] = useState<
    Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>
  >({});
  const [loadingOverlays, setLoadingOverlays] = useState<Set<OverlayKey>>(() => new Set());

  const loadingRef = useRef(new Set<OverlayKey>());
  useEffect(() => {
    for (const key of activeOverlays) {
      if (key === "docks" || key === "accessibility") continue;
      if (overlayData[key]) continue;
      if (loadingRef.current.has(key)) continue;

      loadingRef.current.add(key);
      setLoadingOverlays((prev) => new Set([...prev, key]));

      getOverlay(key)
        .then((data) => setOverlayData((prev) => ({ ...prev, [key]: data })))
        .catch((err) => console.warn(`Overlay "${key}" failed to load`, err))
        .finally(() => {
          loadingRef.current.delete(key);
          setLoadingOverlays((prev) => {
            const next = new Set(prev);
            next.delete(key);
            return next;
          });
        });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOverlays]);

  const toggleOverlay = useCallback((key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ---- Routing ----
  const [origin, setOrigin] = useState<GeocodedPlace | null>(null);
  const [destination, setDestination] = useState<GeocodedPlace | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeNotices, setRouteNotices] = useState<string[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [departureTime, setDepartureTime] = useState<string | null>(null);

  // Clear routes when inputs change
  useEffect(() => {
    if (mode === "routing") { setRoutes([]); setSelectedRouteIndex(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, departureTime]);

  // Clear routes when navigating away from routing and back
  useEffect(() => {
    if (prevModeRef.current === "designer" && mode === "routing") {
      setRoutes([]); setSelectedRouteIndex(null);
    }
  }, [mode]);

  const getDirections = useCallback(() => {
    if (!origin || !destination || mode !== "routing") return;

    const zoom = zoomForBounds(origin, destination);
    setFlyTo({
      latitude: (origin.lat + destination.lat) / 2,
      longitude: (origin.lng + destination.lng) / 2,
      zoom, _ts: Date.now(),
    });

    setIsLoadingRoutes(true);
    computeRoutes(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
      ["walk", "bike", "bikeshare", "transit", "transit_bike"],
      departureTime || undefined,
    )
      .then(({ routes: results, notices }) => {
        setRoutes(results); setRouteNotices(notices);
        setSelectedRouteIndex(results.length > 0 ? 0 : null);
      })
      .catch((err) => { console.error("Route computation failed:", err); setRoutes([]); setRouteNotices([]); })
      .finally(() => setIsLoadingRoutes(false));
  }, [origin, destination, mode, departureTime]);

  // ---- Derived ----
  const selectedRoute = selectedRouteIndex !== null ? (routes[selectedRouteIndex] ?? null) : null;
  const originLatLng: LatLng | null = origin ? { lat: origin.lat, lng: origin.lng } : null;
  const destLatLng: LatLng | null = destination ? { lat: destination.lat, lng: destination.lng } : null;

  // ---- Context value ----
  const value: AppContextValue = {
    mode,
    flyTo, setFlyTo,
    mapCallbacks, registerMapCallbacks,
    selectedStationId, setSelectedStationId,
    autoFocusName, setAutoFocusName,
    contextMenu, setContextMenu,
    modal, setModal, closeModal,
    activeOverlays, setActiveOverlays, overlayData, loadingOverlays, toggleOverlay,
    origin, destination, setOrigin, setDestination,
    routes, routeNotices,
    selectedRouteIndex, setSelectedRouteIndex,
    isLoadingRoutes,
    departureTime, setDepartureTime,
    getDirections,
    selectedRoute, originLatLng, destLatLng,
    previewStations, setPreviewStations,
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}
