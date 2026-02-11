"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import SideNav, { MobileTabBar } from "@/components/SideNav";
import AppSidebar from "@/components/AppSidebar";
import MobileSidebar from "@/components/MobileSidebar";
import ContextMenu, { type ContextMenuState } from "@/components/ContextMenu";
import OverlayControls from "@/components/OverlayControls";
import AppModal, { type ModalState } from "@/components/Modal";
import { DocsContent } from "@/components/DocsView";
import { useIsMobile } from "@/lib/useMediaQuery";
import type {
  AppMode,
  GeocodedPlace,
  BikeStation,
  RouteOption,
  LatLng,
  OverlayKey,
  PlannerWeights,
  PlannerDecayRadii,
  PlannerDensityScales,
  PlannerConfig,
  PlannerCoverage,
  SavedNetwork,
  BuildLogEntry,
  BuildLogParams,
} from "@/lib/types";
import { saveNetwork } from "@/lib/savedNetworks";
import type { FlyToTarget } from "@/components/DeckMap";
import {
  getStations,
  saveStations,
  clearStations as apiClearStations,
  computeRoutes,
  reverseGeocode,
  getOverlay,
  getPlannerHexGrid,
  runPlannerOptimize,
  stepPlanner,
} from "@/lib/api";
import { useUndoRedo } from "@/lib/useUndoRedo";

const DeckMap = dynamic(() => import("@/components/DeckMap"), { ssr: false });

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

let stationCounter = 100;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function Home() {
  const isMobile = useIsMobile();

  // ---- App mode ----
  const [mode, setModeRaw] = useState<AppMode>("routing");
  const setMode = useCallback((m: AppMode) => {
    setModeRaw(m);
    setSelectedStationId(null);
    setContextMenu(null);
    setPreviewStations(null);
  }, []);

  // ---- Mobile sidebar open/close ----
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  /** Mobile tab handler: toggle sidebar or switch mode */
  const handleMobileTab = useCallback(
    (m: AppMode) => {
      if (m === mode) {
        // Same tab: toggle the sheet (unless docs — docs is full-screen)
        if (m !== "docs") setMobileSidebarOpen((o) => !o);
      } else {
        setMode(m);
        // Open sidebar for non-docs modes, close for docs
        setMobileSidebarOpen(m !== "docs");
      }
    },
    [mode, setMode],
  );

  // ---- Docs state ----
  const [docsActiveId, setDocsActiveId] = useState("introduction");
  const [docsScrollTarget, setDocsScrollTarget] = useState<string | null>(null);
  const handleDocsNavigate = useCallback((id: string) => {
    setDocsActiveId(id);
    setDocsScrollTarget(id);
    // On mobile, close the sidebar after nav click so content is visible
    if (typeof window !== "undefined" && window.innerWidth < 768) {
      setMobileSidebarOpen(false);
    }
  }, []);
  const handleDocsScrollHandled = useCallback(() => setDocsScrollTarget(null), []);
  const handleDocsActiveChange = useCallback((id: string) => setDocsActiveId(id), []);

  // ---- Modal state (replaces window.alert / confirm / prompt) ----
  const [modal, setModal] = useState<ModalState>(null);
  const closeModal = useCallback(() => setModal(null), []);

  // ---- Routing state ----
  const [origin, setOrigin] = useState<GeocodedPlace | null>(null);
  const [destination, setDestination] = useState<GeocodedPlace | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeNotices, setRouteNotices] = useState<string[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(null);
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [departureTime, setDepartureTime] = useState<string | null>(null);

  // ---- Active network identity ----
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);
  const [activeNetworkName, setActiveNetworkName] = useState("Untitled Network");

  // ---- Station + build log state with undo/redo ----
  interface NetworkState { stations: BikeStation[]; buildLog: BuildLogEntry[] }
  const undoRedo = useUndoRedo<NetworkState>({ stations: [], buildLog: [] });
  const { stations, buildLog } = undoRedo.state;

  // ---- Shared state ----
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);

  // ---- Designer state ----
  const [selectedStationId, setSelectedStationId] = useState<string | null>(null);
  const [autoFocusName, setAutoFocusName] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Overlay state ----
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(
    () => new Set<OverlayKey>(["lrt", "bike", "docks"]),
  );
  const [overlayData, setOverlayData] = useState<
    Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>
  >({});
  const [loadingOverlays, setLoadingOverlays] = useState<Set<OverlayKey>>(() => new Set());

  // ---- Planner state ----
  const [plannerWeights, setPlannerWeights] = useState<PlannerWeights>({
    population: 0, lrt: 0, bike_infra: 0, transit: 0,
    commercial: 0, education: 0, recreation: 0,
  });
  const [decayRadii, setDecayRadii] = useState<PlannerDecayRadii>({
    lrt: 2000, bike_infra: 200, transit: 800,
  });
  const [densityScales, setDensityScales] = useState<PlannerDensityScales>({
    commercial: 30, education: 5, recreation: 8,
  });
  const [plannerConfig, setPlannerConfig] = useState<PlannerConfig>({
    algorithm: "iterative_mclp",
    batchSize: 5,
    numStations: 40,
    coverageRadiusM: 1000,
    minSpacingM: 800,
    totalBikes: 600,
    minDocksPerStation: 15,
    maxDocksPerStation: 30,
    targetFillPct: 0.5,
    proximityDiscountRadius: 500,
    proximityDiscountStrength: 70,
    connectivityRadius: 2000,
    connectivityStrength: 60,
  });
  const [showSuitability, setShowSuitability] = useState(true);
  const [suitabilityData, setSuitabilityData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [isSuitabilityLoading, setIsSuitabilityLoading] = useState(false);

  // ---- Eagerly load suitability hex grid ----
  useEffect(() => {
    if (!suitabilityData && !isSuitabilityLoading) {
      setIsSuitabilityLoading(true);
      getPlannerHexGrid()
        .then((data) => setSuitabilityData(data))
        .catch((err) => console.error("Failed to pre-load suitability hex grid:", err))
        .finally(() => setIsSuitabilityLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [plannerCoverage, setPlannerCoverage] = useState<PlannerCoverage | null>(null);
  const [generatedStations, setGeneratedStations] = useState<BikeStation[] | null>(null);

  // ---- Build log helpers ----
  const [previewStations, setPreviewStations] = useState<BikeStation[] | null>(null);

  /** Push new stations + a build log entry together as one undo step. */
  const pushWithLog = useCallback((newStations: BikeStation[], entry: BuildLogEntry) => {
    undoRedo.push({ stations: newStations, buildLog: [...buildLog, entry] });
  }, [undoRedo, buildLog]);

  /** Push new stations + multiple build log entries together as one undo step. */
  const pushWithLogs = useCallback((newStations: BikeStation[], entries: BuildLogEntry[]) => {
    undoRedo.push({ stations: newStations, buildLog: [...buildLog, ...entries] });
  }, [undoRedo, buildLog]);

  /** Snapshot current planner params for a build log entry. */
  const currentParams = useCallback((): BuildLogParams => ({
    weights: { ...plannerWeights },
    decayRadii: { ...decayRadii },
    densityScales: { ...densityScales },
    config: { ...plannerConfig },
  }), [plannerWeights, decayRadii, densityScales, plannerConfig]);

  // ---- Load stations on mount ----
  useEffect(() => {
    getStations()
      .then((loaded) => undoRedo.reset({ stations: loaded, buildLog: [] }))
      .catch((err) => console.error("Failed to load stations:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load overlay data when activated ----
  const loadingRef = useRef(new Set<OverlayKey>());
  useEffect(() => {
    for (const key of activeOverlays) {
      if (key === "docks") continue;
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

  // ---- Sync stations to backend (debounced) ----
  const syncStationsToBackend = useCallback((updated: BikeStation[]) => {
    if (syncRef.current) clearTimeout(syncRef.current);
    syncRef.current = setTimeout(() => {
      saveStations(updated).catch((err) => console.error("Failed to sync stations:", err));
    }, 500);
  }, []);

  const prevStationsRef = useRef<BikeStation[]>(stations);
  useEffect(() => {
    if (stations !== prevStationsRef.current) {
      prevStationsRef.current = stations;
      syncStationsToBackend(stations);
    }
  }, [stations, syncStationsToBackend]);

  // ---- Clear selection if station removed (e.g. by undo) ----
  useEffect(() => {
    if (selectedStationId && !stations.some((s) => s.id === selectedStationId)) {
      setSelectedStationId(null);
    }
  }, [stations, selectedStationId]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        if (modal) { closeModal(); return; }
        if (contextMenu) { setContextMenu(null); return; }
        if (selectedStationId) { setSelectedStationId(null); return; }
        return;
      }

      if (mode === "designer" && e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); undoRedo.undo(); return;
      }
      if (mode === "designer" && ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey))) {
        e.preventDefault(); undoRedo.redo(); return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mode, contextMenu, selectedStationId, undoRedo, modal, closeModal]);

  // ---- Clear routes when inputs change ----
  useEffect(() => {
    if (mode === "routing") { setRoutes([]); setSelectedRouteIndex(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, departureTime]);

  // ---- Fly to place ----
  const handleFlyToPlace = useCallback((place: GeocodedPlace) => {
    setFlyTo({ latitude: place.lat, longitude: place.lng, zoom: 14, _ts: Date.now() });
  }, []);

  // ---- Get Directions ----
  const handleGetDirections = useCallback(() => {
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

  // ---- Clear routes when switching back from designer ----
  const prevModeRef = useRef<AppMode>(mode);
  useEffect(() => {
    if (prevModeRef.current === "designer" && mode === "routing") {
      setRoutes([]); setSelectedRouteIndex(null);
    }
    prevModeRef.current = mode;
  }, [mode]);

  // ---- Derived ----
  const selectedRoute = selectedRouteIndex !== null ? (routes[selectedRouteIndex] ?? null) : null;
  const originLatLng: LatLng | null = origin ? { lat: origin.lat, lng: origin.lng } : null;
  const destLatLng: LatLng | null = destination ? { lat: destination.lat, lng: destination.lng } : null;

  // ===========================================================================
  // Routing handlers
  // ===========================================================================

  const handleSetOrigin = useCallback((place: GeocodedPlace | null) => setOrigin(place), []);
  const handleSetDestination = useCallback((place: GeocodedPlace | null) => setDestination(place), []);
  const handleSelectRoute = useCallback((index: number) => setSelectedRouteIndex(index), []);

  const handleRoutingMapClick = useCallback(
    async (lngLat: { lng: number; lat: number }) => {
      try {
        const place = await reverseGeocode(lngLat.lat, lngLat.lng);
        if (!origin) setOrigin(place); else setDestination(place);
      } catch {
        const place: GeocodedPlace = {
          label: `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`,
          lat: lngLat.lat, lng: lngLat.lng,
        };
        if (!origin) setOrigin(place); else setDestination(place);
      }
    },
    [origin],
  );

  // ===========================================================================
  // Designer handlers
  // ===========================================================================

  const handleDesignerMapClick = useCallback(() => {
    setSelectedStationId(null); setContextMenu(null);
  }, []);

  const handleRightClick = useCallback(
    (info: { screenX: number; screenY: number; lng: number; lat: number }) => {
      if (mode !== "designer") return;
      setContextMenu({ x: info.screenX, y: info.screenY, lng: info.lng, lat: info.lat });
    },
    [mode],
  );

  const handleAddStationAt = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      stationCounter++;
      const newStation: BikeStation = {
        id: `s_new_${stationCounter}`, name: `New Station ${stationCounter - 100}`,
        lat: lngLat.lat, lng: lngLat.lng, capacity: 20, bikes: 10,
      };
      pushWithLog([...stations, newStation], {
        action: "manual_place", timestamp: new Date().toISOString(),
        stationId: newStation.id, lat: lngLat.lat, lng: lngLat.lng,
      });
      setSelectedStationId(newStation.id);
      setAutoFocusName(true);
    },
    [stations, pushWithLog],
  );

  const handleStationClick = useCallback((stationId: string) => {
    setContextMenu(null); setSelectedStationId(stationId); setAutoFocusName(false);
  }, []);

  const handleStationDragEnd = useCallback(
    (stationId: string, lngLat: { lng: number; lat: number }) => {
      const prev = stations.find((s) => s.id === stationId);
      const updated = stations.map((s) =>
        s.id === stationId ? { ...s, lat: lngLat.lat, lng: lngLat.lng } : s,
      );
      if (prev) {
        pushWithLog(updated, {
          action: "move_station", timestamp: new Date().toISOString(),
          stationId, fromLat: prev.lat, fromLng: prev.lng,
          toLat: lngLat.lat, toLng: lngLat.lng,
        });
      } else {
        undoRedo.push({ stations: updated, buildLog });
      }
    },
    [stations, undoRedo, buildLog, pushWithLog],
  );

  const handleUpdateStation = useCallback(
    (id: string, updates: Partial<BikeStation>) => {
      const updated = stations.map((s) => (s.id === id ? { ...s, ...updates } : s));
      undoRedo.replace({ stations: updated, buildLog });
    },
    [stations, buildLog, undoRedo],
  );

  const handleCommitStation = useCallback(() => undoRedo.commit(), [undoRedo]);

  const handleDeleteStation = useCallback(
    (id: string) => {
      const station = stations.find((s) => s.id === id);
      const updated = stations.filter((s) => s.id !== id);
      pushWithLog(updated, {
        action: "delete_station", timestamp: new Date().toISOString(),
        stationId: id, stationName: station?.name ?? id,
      });
      if (selectedStationId === id) setSelectedStationId(null);
    },
    [stations, selectedStationId, pushWithLog],
  );

  const handleResetStations = useCallback(() => {
    const count = stations.length;
    apiClearStations()
      .then((s) => {
        pushWithLog(s, {
          action: "clear_all", timestamp: new Date().toISOString(),
          stationsRemoved: count,
        });
        setSelectedStationId(null);
      })
      .catch((err) => console.error("Failed to clear stations:", err));
  }, [stations.length, pushWithLog]);

  /** Show confirm modal, then clear */
  const handleClearAll = useCallback(() => {
    if (stations.length === 0) return;
    setModal({
      type: "confirm",
      title: "Clear All Stations",
      message: `This will remove all ${stations.length} stations from your network. This action can be undone.`,
      onConfirm: handleResetStations,
    });
  }, [stations.length, handleResetStations]);

  // ===========================================================================
  // Planner handlers
  // ===========================================================================

  const handleToggleSuitability = useCallback(() => {
    const next = !showSuitability;
    setShowSuitability(next);
    if (next && !suitabilityData && !isSuitabilityLoading) {
      setIsSuitabilityLoading(true);
      getPlannerHexGrid()
        .then((data) => setSuitabilityData(data))
        .catch((err) => { console.error("Failed to load suitability hex grid:", err); setShowSuitability(false); })
        .finally(() => setIsSuitabilityLoading(false));
    }
  }, [showSuitability, suitabilityData, isSuitabilityLoading]);

  /** Stores the generate_all log entry so it can be bundled with apply_generated. */
  const pendingGenerateLogRef = useRef<BuildLogEntry | null>(null);

  const handleRunOptimize = useCallback(() => {
    setIsOptimizing(true); setOptimizeError(null); setPlannerCoverage(null); setGeneratedStations(null);
    pendingGenerateLogRef.current = null;

    const doOptimize = async () => {
      try {
        if (!suitabilityData) {
          const hexData = await getPlannerHexGrid();
          setSuitabilityData(hexData);
        }
        const result = await runPlannerOptimize({
          algorithm: plannerConfig.algorithm, batch_size: plannerConfig.batchSize,
          num_stations: plannerConfig.numStations, coverage_radius_m: plannerConfig.coverageRadiusM,
          min_spacing_m: plannerConfig.minSpacingM, total_bikes: plannerConfig.totalBikes,
          min_docks_per_station: plannerConfig.minDocksPerStation, max_docks_per_station: plannerConfig.maxDocksPerStation,
          target_fill_pct: plannerConfig.targetFillPct,
          proximity_discount_radius: plannerConfig.proximityDiscountRadius,
          proximity_discount_strength: plannerConfig.proximityDiscountStrength,
          connectivity_radius: plannerConfig.connectivityRadius,
          connectivity_strength: plannerConfig.connectivityStrength,
          decay_radii: decayRadii, density_scales: densityScales, weights: plannerWeights,
          existing_stations: stations.map((s) => ({ lat: s.lat, lng: s.lng, capacity: s.capacity })),
        });
        setPlannerCoverage(result.coverage); setGeneratedStations(result.stations);
        // Stash the generate_all entry — it gets pushed with apply_generated
        pendingGenerateLogRef.current = {
          action: "generate_all", timestamp: new Date().toISOString(),
          stationsAdded: result.stations.map((s) => s.id),
          params: currentParams(), coverage: result.coverage,
          solveTimeS: result.solve_time_s,
        };
      } catch (err) {
        console.error("Optimization failed:", err);
        setOptimizeError(err instanceof Error ? err.message : String(err));
      } finally { setIsOptimizing(false); }
    };
    doOptimize();
  }, [plannerConfig, plannerWeights, suitabilityData, decayRadii, densityScales, stations, currentParams]);

  const handleStep = useCallback(() => {
    setIsStepping(true); setOptimizeError(null);

    const doStep = async () => {
      try {
        if (!suitabilityData) {
          const hexData = await getPlannerHexGrid();
          setSuitabilityData(hexData);
        }
        const result = await stepPlanner({
          min_spacing_m: plannerConfig.minSpacingM,
          min_docks_per_station: plannerConfig.minDocksPerStation,
          max_docks_per_station: plannerConfig.maxDocksPerStation,
          target_fill_pct: plannerConfig.targetFillPct,
          proximity_discount_radius: plannerConfig.proximityDiscountRadius,
          proximity_discount_strength: plannerConfig.proximityDiscountStrength,
          connectivity_radius: plannerConfig.connectivityRadius,
          connectivity_strength: plannerConfig.connectivityStrength,
          decay_radii: decayRadii, density_scales: densityScales, weights: plannerWeights,
          existing_stations: stations.map((s) => ({ lat: s.lat, lng: s.lng, capacity: s.capacity })),
        });

        if (!result.station) {
          setOptimizeError(result.message ?? "No viable location found"); return;
        }

        const steppedCount = stations.filter((s) => s.id.startsWith("step_")).length;
        const newStation: BikeStation = {
          ...result.station, id: `step_${Date.now()}_${steppedCount}`, name: `Station ${stations.length + 1}`,
        };
        const next = [...stations, newStation];
        pushWithLog(next, {
          action: "step", timestamp: new Date().toISOString(),
          stationId: newStation.id, params: currentParams(),
          resultLat: newStation.lat, resultLng: newStation.lng,
          resultCapacity: newStation.capacity,
        });
        saveStations(next).catch(console.error);
      } catch (err) {
        console.error("Step failed:", err);
        setOptimizeError(err instanceof Error ? err.message : String(err));
      } finally { setIsStepping(false); }
    };
    doStep();
  }, [plannerConfig, plannerWeights, decayRadii, densityScales, suitabilityData, stations, pushWithLog, currentParams]);

  const handleSeedLRT = useCallback(() => {
    const lrtData = overlayData.lrt;
    if (!lrtData) {
      if (!activeOverlays.has("lrt")) setActiveOverlays((prev) => new Set([...prev, "lrt"]));
      setModal({ type: "alert", title: "LRT Data Loading", message: "LRT data is still loading \u2014 try again in a moment." });
      return;
    }
    const lrtPoints = lrtData.features.filter((f) => f.geometry.type === "Point");
    if (lrtPoints.length === 0) {
      setModal({ type: "alert", title: "No LRT Stations", message: "No LRT station points found in overlay data." });
      return;
    }
    const LAT_M = 111320;
    const LNG_M = 111320 * Math.cos(53.5 * Math.PI / 180);
    const NEAR_THRESHOLD = 200;

    const newStations: BikeStation[] = [];
    let counter = 0;
    for (const feat of lrtPoints) {
      const [lng, lat] = (feat.geometry as GeoJSON.Point).coordinates;
      const name = feat.properties?.name || "LRT Station";
      const alreadyNear = stations.some((s) => {
        const d = Math.sqrt(((s.lat - lat) * LAT_M) ** 2 + ((s.lng - lng) * LNG_M) ** 2);
        return d < NEAR_THRESHOLD;
      });
      if (alreadyNear) continue;
      counter++;
      newStations.push({
        id: `lrt_seed_${counter}_${Date.now()}`, name: `${name} Dock`,
        lat, lng, capacity: 30, bikes: 15,
      });
    }

    if (newStations.length === 0) {
      setModal({ type: "alert", title: "Already Seeded", message: "All LRT stations already have docks nearby." });
      return;
    }
    pushWithLog([...stations, ...newStations], {
      action: "seed_lrt", timestamp: new Date().toISOString(),
      stationsAdded: newStations.map((s) => s.id),
    });
  }, [overlayData, activeOverlays, stations, pushWithLog, setModal]);

  const handleApplyStations = useCallback(() => {
    if (!generatedStations) return;
    const existingIds = new Set(stations.map((s) => s.id));
    const rekeyed = generatedStations.map((s, i) => {
      if (!existingIds.has(s.id)) return s;
      return { ...s, id: `gen_${Date.now()}_${i}` };
    });
    // Bundle the generate_all entry (stashed from handleRunOptimize) with apply_generated
    const entries: BuildLogEntry[] = [];
    if (pendingGenerateLogRef.current) {
      entries.push(pendingGenerateLogRef.current);
      pendingGenerateLogRef.current = null;
    }
    entries.push({
      action: "apply_generated", timestamp: new Date().toISOString(),
      stationsAdded: rekeyed.map((s) => s.id),
    });
    pushWithLogs([...stations, ...rekeyed], entries);
    setGeneratedStations(null);
    setPlannerCoverage(null);
  }, [generatedStations, stations, pushWithLogs]);

  // ===========================================================================
  // Overlay toggle
  // ===========================================================================

  const handleToggleOverlay = useCallback((key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  // ===========================================================================
  // Save / Load / New
  // ===========================================================================

  /** Build the current SavedNetwork payload. */
  const buildDraft = useCallback((id: string, name: string): SavedNetwork => ({
    version: 2, id,
    name: name.trim() || `Network \u2013 ${stations.length} stations`,
    savedAt: new Date().toISOString(),
    stations, plannerConfig, plannerWeights, decayRadii, densityScales, buildLog,
  }), [stations, plannerConfig, plannerWeights, decayRadii, densityScales, buildLog]);

  /** Save in-place (if previously saved) or prompt for name (if new). */
  const handleSaveNetwork = useCallback(() => {
    if (activeNetworkId) {
      // In-place save — update existing draft
      const draft = buildDraft(activeNetworkId, activeNetworkName);
      saveNetwork(draft);
      setModal({ type: "alert", title: "Saved", message: `"${activeNetworkName}" has been saved.` });
    } else {
      // First save — prompt for name
      const defaultName = `Network \u2013 ${stations.length} stations`;
      setModal({
        type: "prompt",
        title: "Save Network",
        message: "Give your network a name.",
        defaultValue: defaultName,
        placeholder: "Network name\u2026",
        onSubmit: (name: string) => {
          const id = crypto.randomUUID();
          const finalName = name.trim() || defaultName;
          const draft = buildDraft(id, finalName);
          saveNetwork(draft);
          setActiveNetworkId(id);
          setActiveNetworkName(finalName);
        },
      });
    }
  }, [activeNetworkId, activeNetworkName, stations.length, buildDraft, setModal]);

  /** Save As — always creates a new copy with a new name. */
  const handleSaveAsNetwork = useCallback(() => {
    const defaultName = activeNetworkName
      ? `${activeNetworkName} (copy)`
      : `Network \u2013 ${stations.length} stations`;
    setModal({
      type: "prompt",
      title: "Save As New Network",
      message: "Give this copy a new name.",
      defaultValue: defaultName,
      placeholder: "Network name\u2026",
      onSubmit: (name: string) => {
        const id = crypto.randomUUID();
        const finalName = name.trim() || defaultName;
        const draft = buildDraft(id, finalName);
        saveNetwork(draft);
        setActiveNetworkId(id);
        setActiveNetworkName(finalName);
      },
    });
  }, [activeNetworkName, stations.length, buildDraft, setModal]);

  /** Load a saved network — becomes the active network. */
  const handleLoadNetwork = useCallback(
    (network: SavedNetwork) => {
      undoRedo.reset({ stations: network.stations, buildLog: network.buildLog ?? [] });
      setPlannerConfig(network.plannerConfig);
      // Backfill missing keys from older saved networks that predate new factors
      const defaultWeights: PlannerWeights = {
        population: 0, lrt: 0, bike_infra: 0, transit: 0,
        commercial: 0, education: 0, recreation: 0,
      };
      const defaultRadii: PlannerDecayRadii = { lrt: 2000, bike_infra: 200, transit: 800 };
      const defaultScales: PlannerDensityScales = { commercial: 30, education: 5, recreation: 8 };
      setPlannerWeights({ ...defaultWeights, ...network.plannerWeights });
      setDecayRadii({ ...defaultRadii, ...network.decayRadii });
      setDensityScales({ ...defaultScales, ...network.densityScales });
      setActiveNetworkId(network.id);
      setActiveNetworkName(network.name);
      saveStations(network.stations).catch((err) => console.error("Failed to sync loaded stations:", err));
      setMode("designer");
    },
    [undoRedo, setMode],
  );

  /** Start a brand-new empty network. */
  const handleNewNetwork = useCallback(() => {
    const doNew = () => {
      undoRedo.reset({ stations: [], buildLog: [] });
      setPlannerWeights({ population: 0, lrt: 0, bike_infra: 0, transit: 0, commercial: 0, education: 0, recreation: 0 });
      setDecayRadii({ lrt: 2000, bike_infra: 200, transit: 800 });
      setDensityScales({ commercial: 30, education: 5, recreation: 8 });
      setPlannerConfig({
        algorithm: "iterative_mclp", batchSize: 5, numStations: 40,
        coverageRadiusM: 1000, minSpacingM: 800, totalBikes: 600,
        minDocksPerStation: 15, maxDocksPerStation: 30, targetFillPct: 0.5,
        proximityDiscountRadius: 500, proximityDiscountStrength: 70,
        connectivityRadius: 2000, connectivityStrength: 60,
      });
      setActiveNetworkId(null);
      setActiveNetworkName("Untitled Network");
      setSelectedStationId(null);
      setGeneratedStations(null);
      setPlannerCoverage(null);
      setOptimizeError(null);
      setPreviewStations(null);
      apiClearStations().catch(console.error);
      setMode("designer");
    };

    if (stations.length > 0) {
      setModal({
        type: "confirm",
        title: "New Network",
        message: "Start a new empty network? Any unsaved changes will be lost.",
        onConfirm: doNew,
      });
    } else {
      doNew();
    }
  }, [stations.length, undoRedo, setMode, setModal]);

  /** Rename the active network (in state; persisted on next save). */
  const handleRenameNetwork = useCallback((name: string) => {
    setActiveNetworkName(name);
    // If already saved, update the saved copy immediately
    if (activeNetworkId) {
      const draft = buildDraft(activeNetworkId, name);
      saveNetwork(draft);
    }
  }, [activeNetworkId, buildDraft]);

  // ===========================================================================
  // Build sidebar content (shared between desktop & mobile)
  // ===========================================================================

  const sidebarContent = (
    <AppSidebar
      mode={mode}
      // Routing
      origin={origin}
      destination={destination}
      onSetOrigin={handleSetOrigin}
      onSetDestination={handleSetDestination}
      routes={routes}
      routeNotices={routeNotices}
      selectedRouteIndex={selectedRouteIndex}
      onSelectRoute={handleSelectRoute}
      isLoadingRoutes={isLoadingRoutes}
      departureTime={departureTime}
      onSetDepartureTime={setDepartureTime}
      onGetDirections={handleGetDirections}
      onFlyToPlace={handleFlyToPlace}
      // Designer
      stations={stations}
      selectedStationId={selectedStationId}
      autoFocusName={autoFocusName}
      onSelectStation={setSelectedStationId}
      onUpdateStation={handleUpdateStation}
      onCommitStation={handleCommitStation}
      onDeleteStation={handleDeleteStation}
      onResetStations={handleResetStations}
      onUndo={undoRedo.undo}
      onRedo={undoRedo.redo}
      canUndo={undoRedo.canUndo}
      canRedo={undoRedo.canRedo}
      // Planner
      plannerWeights={plannerWeights}
      onUpdatePlannerWeights={setPlannerWeights}
      decayRadii={decayRadii}
      onUpdateDecayRadii={setDecayRadii}
      densityScales={densityScales}
      onUpdateDensityScales={setDensityScales}
      plannerConfig={plannerConfig}
      onUpdatePlannerConfig={setPlannerConfig}
      showSuitability={showSuitability}
      onToggleSuitability={handleToggleSuitability}
      isSuitabilityLoading={isSuitabilityLoading}
      onRunOptimize={handleRunOptimize}
      isOptimizing={isOptimizing}
      optimizeError={optimizeError}
      plannerCoverage={plannerCoverage}
      onApplyStations={handleApplyStations}
      hasGeneratedStations={!!generatedStations}
      onSeedLRT={handleSeedLRT}
      onStep={handleStep}
      isStepping={isStepping}
      // Active Network
      activeNetworkId={activeNetworkId}
      activeNetworkName={activeNetworkName}
      onRenameNetwork={handleRenameNetwork}
      onSaveNetwork={handleSaveNetwork}
      onSaveAsNetwork={handleSaveAsNetwork}
      onNewNetwork={handleNewNetwork}
      onLoadNetwork={handleLoadNetwork}
      onClearAll={handleClearAll}
      // Build History
      buildLog={buildLog}
      onPreviewSnapshot={setPreviewStations}
      // Docs
      docsActiveId={docsActiveId}
      onDocsNavigate={handleDocsNavigate}
    />
  );

  // ===========================================================================
  // Map content (shared between desktop & mobile)
  // ===========================================================================

  const mapContent = (
    <>
      <DeckMap
        stations={previewStations ?? stations}
        origin={mode === "routing" ? originLatLng : null}
        destination={mode === "routing" ? destLatLng : null}
        selectedRoute={mode === "routing" ? selectedRoute : null}
        flyTo={flyTo}
        onMapClick={mode === "routing" ? handleRoutingMapClick : handleDesignerMapClick}
        onRightClick={mode === "designer" ? handleRightClick : undefined}
        designerMode={mode === "designer"}
        selectedStationId={selectedStationId}
        onStationClick={handleStationClick}
        onDeleteStation={handleDeleteStation}
        onStationDragEnd={handleStationDragEnd}
        overlayData={overlayData}
        activeOverlays={activeOverlays}
        suitabilityData={suitabilityData}
        suitabilityWeights={plannerWeights}
        suitabilityDecayRadii={decayRadii}
        suitabilityDensityScales={densityScales}
        suitabilityConfig={plannerConfig}
        showSuitability={showSuitability && mode === "designer"}
      />
      <OverlayControls
        activeOverlays={activeOverlays}
        loadingOverlays={loadingOverlays}
        onToggle={handleToggleOverlay}
      />
      {contextMenu && mode === "designer" && (
        <ContextMenu
          menu={contextMenu}
          onAddStation={handleAddStationAt}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  );

  const docsContent = (
    <DocsContent
      activeId={docsActiveId}
      onActiveChange={handleDocsActiveChange}
      scrollToId={docsScrollTarget}
      onScrollHandled={handleDocsScrollHandled}
    />
  );

  // ===========================================================================
  // Render
  // ===========================================================================

  if (isMobile) {
    return (
      <main className="relative h-screen w-screen flex flex-col">
        {/* Main content area — above tab bar */}
        <div className="flex-1 relative min-h-0">
          {mode === "docs" ? docsContent : mapContent}
        </div>

        {/* Mobile sidebar (bottom sheet) */}
        <MobileSidebar
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        >
          {sidebarContent}
        </MobileSidebar>

        {/* Bottom tab bar */}
        <MobileTabBar mode={mode} onChangeMode={handleMobileTab} />

        {/* Modal */}
        <AppModal modal={modal} onClose={closeModal} />
      </main>
    );
  }

  // Desktop layout
  // The map is absolutely positioned so it never resizes when the SideNav
  // hover-expands. The sidebar simply slides over the map edge instead.
  const SIDEBAR_W = 380;
  const NAV_W = 48; // collapsed nav width
  const panelLeft = NAV_W + SIDEBAR_W; // 428px

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      {/* Left panel: nav + sidebar (in flow, z-above the map) */}
      <div className="relative z-10 flex h-full w-fit">
        <SideNav mode={mode} onChangeMode={setMode} />
        <div
          className="h-full shrink-0 bg-white shadow-[2px_0_8px_rgba(0,0,0,0.08)]"
          style={{ width: SIDEBAR_W }}
        >
          {sidebarContent}
        </div>
      </div>

      {/* Map / docs: fixed left edge, never resizes on nav hover */}
      <div className="absolute top-0 right-0 bottom-0" style={{ left: panelLeft }}>
        {mode === "docs" ? docsContent : mapContent}
      </div>

      {/* Modal */}
      <AppModal modal={modal} onClose={closeModal} />
    </main>
  );
}
