import { create } from "zustand";
import { devtools, subscribeWithSelector } from "zustand/middleware";
import type {
  BikeStation,
  GeocodedPlace,
  RouteOption,
  LatLng,
  OverlayKey,
  TravelMode,
} from "@/lib/types";
import type { ContextMenuState } from "@/components/ContextMenu";
import type { ModalState } from "@/components/Modal";
import type { FlyToTarget } from "@/components/DeckMap";
import {
  computeRoutes,
  getOverlay,
} from "@/lib/api";
import { useNetworkStore } from "@/lib/networkStore";

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
// Route mode toggles — user-facing transport mode filters
// ---------------------------------------------------------------------------

export type RouteModeToggle = "walk" | "bikeshare" | "lrt" | "bus";

export const ROUTE_MODE_DEFAULTS: Record<RouteModeToggle, boolean> = {
  walk: true,
  bikeshare: true,
  lrt: true,
  bus: false,
};

function togglesToApiModes(t: Record<RouteModeToggle, boolean>): TravelMode[] {
  const modes: TravelMode[] = [];
  if (t.walk) modes.push("walk");
  if (t.bikeshare) modes.push("bikeshare");
  if (t.lrt || t.bus) {
    modes.push("transit");
    if (t.bikeshare) modes.push("transit_bike");
  }
  return modes;
}

function routeMatchesToggles(route: RouteOption, t: Record<RouteModeToggle, boolean>): boolean {
  if (!t.bus && route.legs.some((l) => l.mode === "bus")) return false;
  if (!t.lrt && route.legs.some((l) => l.mode === "lrt")) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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
  routeModeToggles: Record<RouteModeToggle, boolean>;
  setRouteModeToggle: (key: RouteModeToggle, on: boolean) => void;
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
      setOrigin: (p) => set({ origin: p, routes: [], routeNotices: [], selectedRouteIndex: null }, undefined, "routing/setOrigin"),
      setDestination: (p) => set({ destination: p, routes: [], routeNotices: [], selectedRouteIndex: null }, undefined, "routing/setDestination"),
      routes: [],
      routeNotices: [],
      selectedRouteIndex: null,
      setSelectedRouteIndex: (i) => set({ selectedRouteIndex: i }, undefined, "routing/selectRoute"),
      isLoadingRoutes: false,
      departureTime: null,
      setDepartureTime: (t) => set({ departureTime: t }),
      routeModeToggles: { ...ROUTE_MODE_DEFAULTS },
      setRouteModeToggle: (key, on) =>
        set(
          (s) => ({ routeModeToggles: { ...s.routeModeToggles, [key]: on } }),
          undefined,
          "routing/toggleMode",
        ),

      getDirections: () => {
        const { origin, destination, departureTime, routeModeToggles } = get();
        if (!origin || !destination) return;

        const apiModes = togglesToApiModes(routeModeToggles);
        if (apiModes.length === 0) return;

        const sw: [number, number] = [
          Math.min(origin.lng, destination.lng),
          Math.min(origin.lat, destination.lat),
        ];
        const ne: [number, number] = [
          Math.max(origin.lng, destination.lng),
          Math.max(origin.lat, destination.lat),
        ];
        set({
          flyTo: {
            latitude: (origin.lat + destination.lat) / 2,
            longitude: (origin.lng + destination.lng) / 2,
            zoom: 13,
            bounds: [sw, ne],
            padding: 80,
            _ts: Date.now(),
          },
          isLoadingRoutes: true,
        }, undefined, "routing/getDirections");

        const networkStations = useNetworkStore.getState().stations.map((s) => ({
          id: s.id, name: s.name, lat: s.lat, lng: s.lng, bikes: s.bikes, capacity: s.capacity,
        }));

        computeRoutes(
          { lat: origin.lat, lng: origin.lng },
          { lat: destination.lat, lng: destination.lng },
          apiModes,
          departureTime || undefined,
          networkStations.length > 0 ? networkStations : undefined,
        )
          .then(({ routes: results, notices }) => {
            const filtered = results.filter((r) => routeMatchesToggles(r, routeModeToggles));
            set({
              routes: filtered, routeNotices: notices,
              selectedRouteIndex: filtered.length > 0 ? 0 : null,
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
