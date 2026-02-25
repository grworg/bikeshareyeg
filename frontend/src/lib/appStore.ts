import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import type {
  BikeStation,
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
  getOverlay,
} from "@/lib/api";

// ---------------------------------------------------------------------------
// Map callback registration
// ---------------------------------------------------------------------------

export interface MapCallbacks {
  onMapClick?: (lngLat: { lng: number; lat: number }) => void;
  onRightClick?: (info: { screenX: number; screenY: number; lng: number; lat: number }) => void;
}

// ---------------------------------------------------------------------------
// Module-level state (not serializable / no UI relevance)
// ---------------------------------------------------------------------------

let mapCallbacks: MapCallbacks = {};
const loadingKeys = new Set<OverlayKey>();

// ---------------------------------------------------------------------------
// Helpers
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
// Store shape
// ---------------------------------------------------------------------------

interface AppStore {
  // Map — callbacks stored in module-level variable, not in state
  flyTo: FlyToTarget | null;
  setFlyTo: (t: FlyToTarget | null) => void;
  registerMapCallbacks: (cbs: MapCallbacks | null) => void;
  fireMapClick: (lngLat: { lng: number; lat: number }) => void;
  fireMapRightClick: (info: { screenX: number; screenY: number; lng: number; lat: number }) => void;

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
  overlayData: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>;
  loadingOverlays: Set<OverlayKey>;
  toggleOverlay: (key: OverlayKey) => void;
  setActiveOverlays: (updater: Set<OverlayKey> | ((prev: Set<OverlayKey>) => Set<OverlayKey>)) => void;
  loadActiveOverlays: () => void;

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
  clearRoutes: () => void;

  // Preview stations (build history hover)
  previewStations: BikeStation[] | null;
  setPreviewStations: (s: BikeStation[] | null) => void;

  // Clear selection (called on mode change)
  clearSelection: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAppStore = create<AppStore>()(
  devtools(
    subscribeWithSelector((set, get) => ({
      // ---- Map ----
      flyTo: null,
      setFlyTo: (t) => set({ flyTo: t }, undefined, "map/flyTo"),

      // Callbacks live outside the store — no state change, no subscriber notifications
      registerMapCallbacks: (cbs) => { mapCallbacks = cbs ?? {}; },
      fireMapClick: (lngLat) => mapCallbacks.onMapClick?.(lngLat),
      fireMapRightClick: (info) => mapCallbacks.onRightClick?.(info),

      // ---- Selection ----
      selectedStationId: null,
      setSelectedStationId: (id) => set({ selectedStationId: id }, undefined, "selection/station"),
      autoFocusName: false,
      setAutoFocusName: (v) => set({ autoFocusName: v }),
      contextMenu: null,
      setContextMenu: (m) => set({ contextMenu: m }, undefined, "selection/contextMenu"),

      // ---- Modal ----
      modal: null,
      setModal: (m) => set({ modal: m }, undefined, "modal/open"),
      closeModal: () => set({ modal: null }, undefined, "modal/close"),

      // ---- Overlays ----
      activeOverlays: new Set<OverlayKey>(["lrt", "bike", "docks"]),
      overlayData: {},
      loadingOverlays: new Set<OverlayKey>(),

      toggleOverlay: (key) => {
        const { activeOverlays } = get();
        const next = new Set(activeOverlays);
        if (next.has(key)) next.delete(key); else next.add(key);
        set({ activeOverlays: next }, undefined, "overlay/toggle");
        get().loadActiveOverlays();
      },

      setActiveOverlays: (updater) => {
        const { activeOverlays } = get();
        const next = typeof updater === "function" ? updater(activeOverlays) : updater;
        set({ activeOverlays: next }, undefined, "overlay/setActive");
        get().loadActiveOverlays();
      },

      loadActiveOverlays: () => {
        const { activeOverlays, overlayData } = get();
        for (const key of activeOverlays) {
          if (key === "docks" || key === "accessibility") continue;
          if (overlayData[key]) continue;
          if (loadingKeys.has(key)) continue;

          loadingKeys.add(key);
          set({ loadingOverlays: new Set([...get().loadingOverlays, key]) });

          getOverlay(key)
            .then((data) => set({ overlayData: { ...get().overlayData, [key]: data } }, undefined, `overlay/loaded:${key}`))
            .catch((err) => console.warn(`Overlay "${key}" failed to load`, err))
            .finally(() => {
              loadingKeys.delete(key);
              const next = new Set(get().loadingOverlays);
              next.delete(key);
              set({ loadingOverlays: next });
            });
        }
      },

      // ---- Routing ----
      origin: null,
      destination: null,
      setOrigin: (p) => set({ origin: p }, undefined, "routing/setOrigin"),
      setDestination: (p) => set({ destination: p }, undefined, "routing/setDestination"),
      routes: [],
      routeNotices: [],
      selectedRouteIndex: null,
      setSelectedRouteIndex: (i) => set({ selectedRouteIndex: i }, undefined, "routing/selectRoute"),
      isLoadingRoutes: false,
      departureTime: null,
      setDepartureTime: (t) => set({ departureTime: t }),

      getDirections: () => {
        const { origin, destination, departureTime } = get();
        if (!origin || !destination) return;

        const zoom = zoomForBounds(origin, destination);
        set({
          flyTo: {
            latitude: (origin.lat + destination.lat) / 2,
            longitude: (origin.lng + destination.lng) / 2,
            zoom, _ts: Date.now(),
          },
          isLoadingRoutes: true,
        }, undefined, "routing/getDirections");

        computeRoutes(
          { lat: origin.lat, lng: origin.lng },
          { lat: destination.lat, lng: destination.lng },
          ["walk", "bike", "bikeshare", "transit", "transit_bike"],
          departureTime || undefined,
        )
          .then(({ routes: results, notices }) => {
            set({
              routes: results, routeNotices: notices,
              selectedRouteIndex: results.length > 0 ? 0 : null,
            }, undefined, "routing/routesLoaded");
          })
          .catch((err) => {
            console.error("Route computation failed:", err);
            set({ routes: [], routeNotices: [] }, undefined, "routing/routesFailed");
          })
          .finally(() => set({ isLoadingRoutes: false }));
      },

      clearRoutes: () => set({ routes: [], selectedRouteIndex: null }, undefined, "routing/clear"),

      // ---- Preview ----
      previewStations: null,
      setPreviewStations: (s) => set({ previewStations: s }, undefined, "preview/set"),

      // ---- Selection clear ----
      clearSelection: () => set({ selectedStationId: null, contextMenu: null }, undefined, "selection/clear"),
    })),
    { name: "AppStore", enabled: process.env.NODE_ENV === "development" },
  ),
);
