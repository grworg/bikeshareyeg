"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import SideNav from "@/components/SideNav";
import AppSidebar from "@/components/AppSidebar";
import ContextMenu, { type ContextMenuState } from "@/components/ContextMenu";
import OverlayControls from "@/components/OverlayControls";
import type {
  GeocodedPlace,
  BikeStation,
  RouteOption,
  LatLng,
  OverlayKey,
  PlannerWeights,
  PlannerDecayRadii,
  PlannerConfig,
  PlannerCoverage,
  SavedNetwork,
} from "@/lib/types";
import { saveNetwork } from "@/lib/savedNetworks";
import type { FlyToTarget } from "@/components/DeckMap";
import {
  getStations,
  saveStations,
  resetStations as apiResetStations,
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

type AppMode = "routing" | "designer" | "saved";

export default function Home() {
  // ---- App mode ----
  const [mode, setModeRaw] = useState<AppMode>("routing");
  const setMode = useCallback((m: AppMode) => {
    setModeRaw(m);
    setSelectedStationId(null);
    setContextMenu(null);
  }, []);

  // ---- Routing state ----
  const [origin, setOrigin] = useState<GeocodedPlace | null>(null);
  const [destination, setDestination] = useState<GeocodedPlace | null>(null);
  const [routes, setRoutes] = useState<RouteOption[]>([]);
  const [routeNotices, setRouteNotices] = useState<string[]>([]);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState<number | null>(
    null,
  );
  const [isLoadingRoutes, setIsLoadingRoutes] = useState(false);
  const [departureTime, setDepartureTime] = useState<string | null>(null);

  // ---- Station state with undo/redo ----
  const undoRedo = useUndoRedo<BikeStation[]>([]);
  const stations = undoRedo.state;

  // ---- Shared state ----
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);

  // ---- Designer state ----
  const [selectedStationId, setSelectedStationId] = useState<string | null>(
    null,
  );
  /** True when a station was just created — triggers auto-focus of name input */
  const [autoFocusName, setAutoFocusName] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ---- Overlay state ----
  const [activeOverlays, setActiveOverlays] = useState<Set<OverlayKey>>(
    () => new Set<OverlayKey>(["lrt", "bike", "docks"]), // bike lanes, LRT, docks on by default
  );
  const [overlayData, setOverlayData] = useState<
    Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>
  >({});
  const [loadingOverlays, setLoadingOverlays] = useState<Set<OverlayKey>>(
    () => new Set(),
  );

  // ---- Planner state ----
  const [plannerWeights, setPlannerWeights] = useState<PlannerWeights>({
    population: 0,
    lrt: 0,
    bike_infra: 0,
    transit: 0,
  });
  const [decayRadii, setDecayRadii] = useState<PlannerDecayRadii>({
    lrt: 2000,
    bike_infra: 1000,
    transit: 800,
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

  // ---- Eagerly load suitability hex grid (independent of overlay toggles) ----
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

  // ---- Load stations on mount ----
  useEffect(() => {
    getStations()
      .then((loaded) => undoRedo.reset(loaded))
      .catch((err) => console.error("Failed to load stations:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Load overlay data when an overlay is activated ----
  const loadingRef = useRef(new Set<OverlayKey>());
  useEffect(() => {
    for (const key of activeOverlays) {
      if (key === "docks") continue; // purely client-side, no fetch needed
      if (overlayData[key]) continue; // already loaded
      if (loadingRef.current.has(key)) continue; // fetch in-flight

      loadingRef.current.add(key);
      setLoadingOverlays((prev) => new Set([...prev, key]));

      getOverlay(key)
        .then((data) => {
          setOverlayData((prev) => ({ ...prev, [key]: data }));
        })
        .catch((err) => {
          console.warn(`Overlay "${key}" failed to load — toggle off/on to retry.`, err);
        })
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
      saveStations(updated).catch((err) =>
        console.error("Failed to sync stations:", err),
      );
    }, 500);
  }, []);

  // Sync whenever stations change
  const prevStationsRef = useRef<BikeStation[]>(stations);
  useEffect(() => {
    if (stations !== prevStationsRef.current) {
      prevStationsRef.current = stations;
      syncStationsToBackend(stations);
    }
  }, [stations, syncStationsToBackend]);

  // ---- Clear selection if selected station was removed (e.g. by undo) ----
  useEffect(() => {
    if (
      selectedStationId &&
      !stations.some((s) => s.id === selectedStationId)
    ) {
      setSelectedStationId(null);
    }
  }, [stations, selectedStationId]);

  // ---- Keyboard shortcuts: Ctrl+Z, Ctrl+Y/Ctrl+Shift+Z, Escape ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Only handle shortcuts when not typing in an input
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      // Escape: close context menu → deselect station
      if (e.key === "Escape") {
        if (contextMenu) {
          setContextMenu(null);
          return;
        }
        if (selectedStationId) {
          setSelectedStationId(null);
          return;
        }
        return;
      }

      // Undo: Ctrl+Z (only in designer mode)
      if (mode === "designer" && e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault();
        undoRedo.undo();
        return;
      }

      // Redo: Ctrl+Y or Ctrl+Shift+Z (only in designer mode)
      if (
        mode === "designer" &&
        ((e.key === "y" && (e.ctrlKey || e.metaKey)) ||
          (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey))
      ) {
        e.preventDefault();
        undoRedo.redo();
        return;
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mode, contextMenu, selectedStationId, undoRedo]);

  // ---- Clear routes when inputs change (user must click "Get Directions" again) ----
  useEffect(() => {
    if (mode === "routing") {
      setRoutes([]);
      setSelectedRouteIndex(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [origin, destination, departureTime]);

  // ---- Fly to a place when selected via typed search (not map click or clear) ----
  const handleFlyToPlace = useCallback(
    (place: GeocodedPlace) => {
      setFlyTo({
        latitude: place.lat,
        longitude: place.lng,
        zoom: 14,
        _ts: Date.now(),
      });
    },
    [],
  );

  // ---- Get Directions: compute routes + zoom to fit ----
  const handleGetDirections = useCallback(() => {
    if (!origin || !destination || mode !== "routing") return;

    // Zoom to fit both points
    const zoom = zoomForBounds(origin, destination);
    setFlyTo({
      latitude: (origin.lat + destination.lat) / 2,
      longitude: (origin.lng + destination.lng) / 2,
      zoom,
      _ts: Date.now(),
    });

    // Compute routes
    setIsLoadingRoutes(true);
    computeRoutes(
      { lat: origin.lat, lng: origin.lng },
      { lat: destination.lat, lng: destination.lng },
      ["walk", "bike", "bikeshare", "transit", "transit_bike"],
      departureTime || undefined,
    )
      .then(({ routes: results, notices }) => {
        setRoutes(results);
        setRouteNotices(notices);
        setSelectedRouteIndex(results.length > 0 ? 0 : null);
      })
      .catch((err) => {
        console.error("Route computation failed:", err);
        setRoutes([]);
        setRouteNotices([]);
      })
      .finally(() => {
        setIsLoadingRoutes(false);
      });
  }, [origin, destination, mode, departureTime]);

  // ---- Clear routes when switching back from designer (user can click Get Directions) ----
  const prevModeRef = useRef<AppMode>(mode);
  useEffect(() => {
    if (prevModeRef.current === "designer" && mode === "routing") {
      setRoutes([]);
      setSelectedRouteIndex(null);
    }
    prevModeRef.current = mode;
  }, [mode]);

  // ---- Derived ----
  const selectedRoute =
    selectedRouteIndex !== null ? (routes[selectedRouteIndex] ?? null) : null;
  const originLatLng: LatLng | null = origin
    ? { lat: origin.lat, lng: origin.lng }
    : null;
  const destLatLng: LatLng | null = destination
    ? { lat: destination.lat, lng: destination.lng }
    : null;

  // ===========================================================================
  // Routing mode handlers
  // ===========================================================================

  const handleSetOrigin = useCallback(
    (place: GeocodedPlace | null) => setOrigin(place),
    [],
  );
  const handleSetDestination = useCallback(
    (place: GeocodedPlace | null) => setDestination(place),
    [],
  );
  const handleSelectRoute = useCallback(
    (index: number) => setSelectedRouteIndex(index),
    [],
  );

  const handleRoutingMapClick = useCallback(
    async (lngLat: { lng: number; lat: number }) => {
      try {
        const place = await reverseGeocode(lngLat.lat, lngLat.lng);
        if (!origin) setOrigin(place);
        else setDestination(place);
      } catch {
        const place: GeocodedPlace = {
          label: `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`,
          lat: lngLat.lat,
          lng: lngLat.lng,
        };
        if (!origin) setOrigin(place);
        else setDestination(place);
      }
    },
    [origin],
  );

  // ===========================================================================
  // Designer mode handlers
  // ===========================================================================

  /** Left-click on empty map in designer = deselect current station */
  const handleDesignerMapClick = useCallback(() => {
    setSelectedStationId(null);
    setContextMenu(null);
  }, []);

  /** Right-click on map = show context menu to add station */
  const handleRightClick = useCallback(
    (info: {
      screenX: number;
      screenY: number;
      lng: number;
      lat: number;
    }) => {
      if (mode !== "designer") return;
      setContextMenu({ x: info.screenX, y: info.screenY, lng: info.lng, lat: info.lat });
    },
    [mode],
  );

  /** Add a station at given coordinates (from context menu) */
  const handleAddStationAt = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      stationCounter++;
      const newStation: BikeStation = {
        id: `s_new_${stationCounter}`,
        name: `New Station ${stationCounter - 100}`,
        lat: lngLat.lat,
        lng: lngLat.lng,
        capacity: 20,
        bikes: 10,
      };
      undoRedo.push([...stations, newStation]);
      setSelectedStationId(newStation.id);
      setAutoFocusName(true);
    },
    [stations, undoRedo],
  );

  const handleStationClick = useCallback(
    (stationId: string) => {
      setContextMenu(null);
      setSelectedStationId(stationId);
      setAutoFocusName(false);
    },
    [],
  );

  const handleStationDragEnd = useCallback(
    (stationId: string, lngLat: { lng: number; lat: number }) => {
      const updated = stations.map((s) =>
        s.id === stationId ? { ...s, lat: lngLat.lat, lng: lngLat.lng } : s,
      );
      undoRedo.push(updated);
    },
    [stations, undoRedo],
  );

  const handleUpdateStation = useCallback(
    (id: string, updates: Partial<BikeStation>) => {
      const updated = stations.map((s) =>
        s.id === id ? { ...s, ...updates } : s,
      );
      // Use replace for slider drags (no undo entry per tick)
      undoRedo.replace(updated);
    },
    [stations, undoRedo],
  );

  /** Commit the current replace-state to undo history (called on slider release) */
  const handleCommitStation = useCallback(() => {
    undoRedo.commit();
  }, [undoRedo]);

  const handleDeleteStation = useCallback(
    (id: string) => {
      const updated = stations.filter((s) => s.id !== id);
      undoRedo.push(updated);
      if (selectedStationId === id) setSelectedStationId(null);
    },
    [stations, selectedStationId, undoRedo],
  );

  const handleResetStations = useCallback(() => {
    apiClearStations()
      .then((s) => {
        undoRedo.push(s);
        setSelectedStationId(null);
      })
      .catch((err) => console.error("Failed to clear stations:", err));
  }, [undoRedo]);

  // (Mode switching is handled by SideNav now)

  // ===========================================================================
  // Planner handlers
  // ===========================================================================

  const handleToggleSuitability = useCallback(() => {
    const next = !showSuitability;
    setShowSuitability(next);
    // Fetch hex grid data if not already loaded
    if (next && !suitabilityData && !isSuitabilityLoading) {
      setIsSuitabilityLoading(true);
      getPlannerHexGrid()
        .then((data) => setSuitabilityData(data))
        .catch((err) => {
          console.error("Failed to load suitability hex grid:", err);
          setShowSuitability(false);
        })
        .finally(() => setIsSuitabilityLoading(false));
    }
  }, [showSuitability, suitabilityData, isSuitabilityLoading]);

  const handleRunOptimize = useCallback(() => {
    setIsOptimizing(true);
    setOptimizeError(null);
    setPlannerCoverage(null);
    setGeneratedStations(null);

    // Ensure hex grid is loaded first
    const doOptimize = async () => {
      try {
        // Make sure we have the hex grid
        if (!suitabilityData) {
          const hexData = await getPlannerHexGrid();
          setSuitabilityData(hexData);
        }

        const result = await runPlannerOptimize({
          algorithm: plannerConfig.algorithm,
          batch_size: plannerConfig.batchSize,
          num_stations: plannerConfig.numStations,
          coverage_radius_m: plannerConfig.coverageRadiusM,
          min_spacing_m: plannerConfig.minSpacingM,
          total_bikes: plannerConfig.totalBikes,
          min_docks_per_station: plannerConfig.minDocksPerStation,
          max_docks_per_station: plannerConfig.maxDocksPerStation,
          target_fill_pct: plannerConfig.targetFillPct,
          proximity_discount_radius: plannerConfig.proximityDiscountRadius,
          proximity_discount_strength: plannerConfig.proximityDiscountStrength,
          connectivity_radius: plannerConfig.connectivityRadius,
          connectivity_strength: plannerConfig.connectivityStrength,
          decay_radii: decayRadii,
          weights: plannerWeights,
          existing_stations: stations.map((s) => ({
            lat: s.lat,
            lng: s.lng,
            capacity: s.capacity,
          })),
        });

        setPlannerCoverage(result.coverage);
        setGeneratedStations(result.stations);
      } catch (err) {
        console.error("Optimization failed:", err);
        setOptimizeError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsOptimizing(false);
      }
    };
    doOptimize();
  }, [plannerConfig, plannerWeights, suitabilityData]);

  /** Place a single station at the greedily optimal next location. */
  const handleStep = useCallback(() => {
    setIsStepping(true);
    setOptimizeError(null);

    const doStep = async () => {
      try {
        // Ensure hex grid is loaded
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
          decay_radii: decayRadii,
          weights: plannerWeights,
          existing_stations: stations.map((s) => ({
            lat: s.lat,
            lng: s.lng,
            capacity: s.capacity,
          })),
        });

        if (!result.station) {
          setOptimizeError(result.message ?? "No viable location found");
          return;
        }

        // Give it a sequential name based on how many stepped stations exist
        const steppedCount = stations.filter((s) => s.id.startsWith("step_")).length;
        const newStation: BikeStation = {
          ...result.station,
          id: `step_${Date.now()}_${steppedCount}`,
          name: `Station ${stations.length + 1}`,
        };

        // Add directly to map (no generated preview — immediate placement)
        const next = [...stations, newStation];
        undoRedo.push(next);
        saveStations(next).catch(console.error);
      } catch (err) {
        console.error("Step failed:", err);
        setOptimizeError(err instanceof Error ? err.message : String(err));
      } finally {
        setIsStepping(false);
      }
    };
    doStep();
  }, [plannerConfig, plannerWeights, decayRadii, suitabilityData, stations, undoRedo]);

  /** Seed a large docking station at every LRT stop. */
  const handleSeedLRT = useCallback(() => {
    const lrtData = overlayData.lrt;
    if (!lrtData) {
      // Ensure LRT overlay is loaded first
      if (!activeOverlays.has("lrt")) {
        setActiveOverlays((prev) => new Set([...prev, "lrt"]));
      }
      alert("LRT data is still loading — try again in a moment.");
      return;
    }

    // Extract Point features (LRT stations)
    const lrtPoints = lrtData.features.filter(
      (f) => f.geometry.type === "Point",
    );
    if (lrtPoints.length === 0) {
      alert("No LRT station points found in overlay data.");
      return;
    }

    // Check which LRT stations already have a dock nearby (within 200m)
    const LAT_M = 111320;
    const LNG_M = 111320 * Math.cos(53.5 * Math.PI / 180);
    const NEAR_THRESHOLD = 200; // metres

    const newStations: BikeStation[] = [];
    let counter = 0;
    for (const feat of lrtPoints) {
      const [lng, lat] = (feat.geometry as GeoJSON.Point).coordinates;
      const name = feat.properties?.name || "LRT Station";

      // Skip if there's already a station within threshold
      const alreadyNear = stations.some((s) => {
        const d = Math.sqrt(((s.lat - lat) * LAT_M) ** 2 + ((s.lng - lng) * LNG_M) ** 2);
        return d < NEAR_THRESHOLD;
      });
      if (alreadyNear) continue;

      counter++;
      newStations.push({
        id: `lrt_seed_${counter}_${Date.now()}`,
        name: `${name} Dock`,
        lat,
        lng,
        capacity: 30, // large station
        bikes: 15,
      });
    }

    if (newStations.length === 0) {
      alert("All LRT stations already have docks nearby.");
      return;
    }

    undoRedo.push([...stations, ...newStations]);
  }, [overlayData, activeOverlays, stations, undoRedo]);

  const handleApplyStations = useCallback(() => {
    if (!generatedStations) return;
    // Re-key generated stations to guarantee uniqueness across multiple runs
    const existingIds = new Set(stations.map((s) => s.id));
    const rekeyed = generatedStations.map((s, i) => {
      if (!existingIds.has(s.id)) return s;
      // Collision — mint a new id
      return { ...s, id: `gen_${Date.now()}_${i}` };
    });
    undoRedo.push([...stations, ...rekeyed]);
    setGeneratedStations(null);
    setPlannerCoverage(null);
  }, [generatedStations, stations, undoRedo]);

  // ===========================================================================
  // Overlay toggle
  // ===========================================================================

  const handleToggleOverlay = useCallback((key: OverlayKey) => {
    setActiveOverlays((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  // ===========================================================================
  // Save / Load network drafts
  // ===========================================================================

  const handleSaveNetwork = useCallback(() => {
    const defaultName = `Network – ${stations.length} stations`;
    const name = window.prompt("Name this network draft:", defaultName);
    if (!name) return; // cancelled

    const draft: SavedNetwork = {
      version: 1,
      id: crypto.randomUUID(),
      name: name.trim() || defaultName,
      savedAt: new Date().toISOString(),
      stations,
      plannerConfig,
      plannerWeights,
      decayRadii,
    };
    saveNetwork(draft);
  }, [stations, plannerConfig, plannerWeights, decayRadii]);

  const handleLoadNetwork = useCallback(
    (network: SavedNetwork) => {
      // Restore all state
      undoRedo.reset(network.stations);
      setPlannerConfig(network.plannerConfig);
      setPlannerWeights(network.plannerWeights);
      setDecayRadii(network.decayRadii);
      // Sync stations to backend
      saveStations(network.stations).catch((err) =>
        console.error("Failed to sync loaded stations:", err),
      );
      // Switch to designer mode
      setMode("designer");
    },
    [undoRedo, setMode],
  );

  // ===========================================================================
  // Render
  // ===========================================================================

  return (
    <main className="flex h-screen w-screen">
      {/* Icon rail */}
      <SideNav mode={mode} onChangeMode={setMode} />

      {/* Sidebar */}
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
        // Save / Load
        onSaveNetwork={handleSaveNetwork}
        onLoadNetwork={handleLoadNetwork}
      />

      {/* Map fills remaining space */}
      <div className="flex-1 relative min-w-0">
        <DeckMap
          stations={stations}
          origin={mode === "routing" ? originLatLng : null}
          destination={mode === "routing" ? destLatLng : null}
          selectedRoute={mode === "routing" ? selectedRoute : null}
          flyTo={flyTo}
          onMapClick={
            mode === "routing" ? handleRoutingMapClick : handleDesignerMapClick
          }
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
          suitabilityConfig={plannerConfig}
          showSuitability={showSuitability && mode === "designer"}
        />

        {/* Overlay layer toggles */}
        <OverlayControls
          activeOverlays={activeOverlays}
          loadingOverlays={loadingOverlays}
          onToggle={handleToggleOverlay}
        />

        {/* Right-click context menu (designer mode only) */}
        {contextMenu && mode === "designer" && (
          <ContextMenu
            menu={contextMenu}
            onAddStation={handleAddStationAt}
            onClose={() => setContextMenu(null)}
          />
        )}
      </div>
    </main>
  );
}
