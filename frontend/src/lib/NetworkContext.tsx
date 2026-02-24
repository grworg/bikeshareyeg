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
import type {
  BikeStation,
  BuildLogEntry,
  BuildLogParams,
  PlannerWeights,
  PlannerDecayRadii,
  PlannerDensityScales,
  PlannerConfig,
  PlannerCoverage,
  SavedNetwork,
  OverlayKey,
} from "@/lib/types";
import {
  DEFAULT_DECAY_RADII,
  DEFAULT_DENSITY_SCALES,
  ZERO_WEIGHTS,
} from "@/lib/suitability";
import {
  saveNetwork as persistNetwork,
  getSavedNetwork,
} from "@/lib/savedNetworks";
import {
  getStations,
  saveStations,
  clearStations as apiClearStations,
  getPlannerHexGrid,
  runPlannerOptimize,
  stepPlanner,
  getSharedNetwork,
} from "@/lib/api";
import { useUndoRedo } from "@/lib/useUndoRedo";

// ---------------------------------------------------------------------------
// Default planner config
// ---------------------------------------------------------------------------

const DEFAULT_PLANNER_CONFIG: PlannerConfig = {
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
  minThresholds: {},
};

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

interface NetworkState {
  stations: BikeStation[];
  buildLog: BuildLogEntry[];
}

export interface NetworkContextValue {
  // Identity
  activeNetworkId: string | null;
  activeNetworkName: string;

  // Data (from undo/redo)
  stations: BikeStation[];
  buildLog: BuildLogEntry[];

  // Planner config
  plannerConfig: PlannerConfig;
  setPlannerConfig: (c: PlannerConfig) => void;
  plannerWeights: PlannerWeights;
  setPlannerWeights: (w: PlannerWeights) => void;
  decayRadii: PlannerDecayRadii;
  setDecayRadii: (r: PlannerDecayRadii) => void;
  densityScales: PlannerDensityScales;
  setDensityScales: (d: PlannerDensityScales) => void;

  // Planner results
  generatedStations: BikeStation[] | null;
  plannerCoverage: PlannerCoverage | null;
  optimizeError: string | null;
  isOptimizing: boolean;
  isStepping: boolean;

  // Suitability data (shared with overlays for planner)
  suitabilityData: GeoJSON.FeatureCollection | null;
  showSuitability: boolean;
  isSuitabilityLoading: boolean;
  toggleSuitability: () => void;

  // Station mutations
  addStationAt: (lngLat: { lng: number; lat: number }) => string;
  deleteStation: (id: string) => void;
  updateStation: (id: string, updates: Partial<BikeStation>) => void;
  commitStation: () => void;
  moveStation: (stationId: string, lngLat: { lng: number; lat: number }) => void;
  resetStations: () => void;

  // Undo/redo
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // Planner actions
  runOptimize: () => void;
  step: () => void;
  applyStations: () => void;
  seedLRT: (overlayData: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>, activeOverlays: Set<OverlayKey>) => void;

  // Network lifecycle
  loadNetworkById: (id: string) => Promise<boolean>;
  loadNetwork: (network: SavedNetwork) => void;
  newNetwork: () => void;
  saveCurrentNetwork: () => void;
  saveAsNetwork: (name: string) => void;
  renameNetwork: (name: string) => void;
  buildDraft: (id: string, name: string) => SavedNetwork;

  // Build history
  revertToSnapshot: (stations: BikeStation[], log: BuildLogEntry[]) => void;

  // Auto-save status
  lastAutoSaveAt: string | null;
}

const NetworkContext = createContext<NetworkContextValue | null>(null);

export function useNetwork(): NetworkContextValue {
  const ctx = useContext(NetworkContext);
  if (!ctx) throw new Error("useNetwork must be used within NetworkProvider");
  return ctx;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

let stationCounter = 100;

export function NetworkProvider({ children }: { children: ReactNode }) {
  // ---- Identity ----
  const [activeNetworkId, setActiveNetworkId] = useState<string | null>(null);
  const [activeNetworkName, setActiveNetworkName] = useState("Untitled Network");

  // ---- Station + build log with undo/redo ----
  const undoRedo = useUndoRedo<NetworkState>({ stations: [], buildLog: [] });
  const { stations, buildLog } = undoRedo.state;

  // ---- Planner config ----
  const [plannerConfig, setPlannerConfig] = useState<PlannerConfig>({ ...DEFAULT_PLANNER_CONFIG });
  const [plannerWeights, setPlannerWeights] = useState<PlannerWeights>({ ...ZERO_WEIGHTS });
  const [decayRadii, setDecayRadii] = useState<PlannerDecayRadii>({ ...DEFAULT_DECAY_RADII });
  const [densityScales, setDensityScales] = useState<PlannerDensityScales>({ ...DEFAULT_DENSITY_SCALES });

  // ---- Planner results ----
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [isStepping, setIsStepping] = useState(false);
  const [optimizeError, setOptimizeError] = useState<string | null>(null);
  const [plannerCoverage, setPlannerCoverage] = useState<PlannerCoverage | null>(null);
  const [generatedStations, setGeneratedStations] = useState<BikeStation[] | null>(null);

  // ---- Suitability ----
  const [suitabilityData, setSuitabilityData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [showSuitability, setShowSuitability] = useState(true);
  const [isSuitabilityLoading, setIsSuitabilityLoading] = useState(false);

  // ---- Auto-save ----
  const [lastAutoSaveAt, setLastAutoSaveAt] = useState<string | null>(null);

  // Eagerly load suitability hex grid
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

  // ---- Load stations from backend session on mount ----
  useEffect(() => {
    getStations()
      .then((loaded) => undoRedo.reset({ stations: loaded, buildLog: [] }))
      .catch((err) => console.error("Failed to load stations:", err));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Sync stations to backend (debounced) ----
  const syncRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  // ---- Helpers ----
  const pushWithLog = useCallback((newStations: BikeStation[], entry: BuildLogEntry) => {
    undoRedo.push({ stations: newStations, buildLog: [...buildLog, entry] });
  }, [undoRedo, buildLog]);

  const pushWithLogs = useCallback((newStations: BikeStation[], entries: BuildLogEntry[]) => {
    undoRedo.push({ stations: newStations, buildLog: [...buildLog, ...entries] });
  }, [undoRedo, buildLog]);

  const currentParams = useCallback((): BuildLogParams => ({
    weights: { ...plannerWeights },
    decayRadii: { ...decayRadii },
    densityScales: { ...densityScales },
    config: { ...plannerConfig },
  }), [plannerWeights, decayRadii, densityScales, plannerConfig]);

  const buildDraft = useCallback((id: string, name: string): SavedNetwork => ({
    version: 2, id,
    name: name.trim() || `Network \u2013 ${stations.length} stations`,
    savedAt: new Date().toISOString(),
    stations, plannerConfig, plannerWeights, decayRadii, densityScales, buildLog,
  }), [stations, plannerConfig, plannerWeights, decayRadii, densityScales, buildLog]);

  // ---- Auto-save to localStorage (debounced) ----
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialLoadRef = useRef(true);
  useEffect(() => {
    // Skip auto-save before a network is loaded
    if (!activeNetworkId) return;
    // Skip the first render after loading (prevents immediate re-save)
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      return;
    }
    if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    autoSaveTimerRef.current = setTimeout(() => {
      const draft = buildDraft(activeNetworkId, activeNetworkName);
      persistNetwork(draft);
      setLastAutoSaveAt(new Date().toISOString());
    }, 1500);
    return () => {
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
    };
  }, [activeNetworkId, activeNetworkName, stations, buildLog, plannerConfig, plannerWeights, decayRadii, densityScales, buildDraft]);

  // ---- Station mutations ----

  const addStationAt = useCallback((lngLat: { lng: number; lat: number }): string => {
    stationCounter++;
    const newStation: BikeStation = {
      id: `s_new_${stationCounter}`,
      name: `New Station ${stationCounter - 100}`,
      lat: lngLat.lat, lng: lngLat.lng, capacity: 20, bikes: 10,
    };
    pushWithLog([...stations, newStation], {
      action: "manual_place", timestamp: new Date().toISOString(),
      stationId: newStation.id, lat: lngLat.lat, lng: lngLat.lng,
    });
    return newStation.id;
  }, [stations, pushWithLog]);

  const deleteStation = useCallback((id: string) => {
    const station = stations.find((s) => s.id === id);
    const updated = stations.filter((s) => s.id !== id);
    pushWithLog(updated, {
      action: "delete_station", timestamp: new Date().toISOString(),
      stationId: id, stationName: station?.name ?? id,
    });
  }, [stations, pushWithLog]);

  const updateStation = useCallback((id: string, updates: Partial<BikeStation>) => {
    const updated = stations.map((s) => (s.id === id ? { ...s, ...updates } : s));
    undoRedo.replace({ stations: updated, buildLog });
  }, [stations, buildLog, undoRedo]);

  const commitStation = useCallback(() => undoRedo.commit(), [undoRedo]);

  const moveStation = useCallback((stationId: string, lngLat: { lng: number; lat: number }) => {
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
  }, [stations, undoRedo, buildLog, pushWithLog]);

  const resetStations = useCallback(() => {
    const count = stations.length;
    apiClearStations()
      .then((s) => {
        pushWithLog(s, {
          action: "clear_all", timestamp: new Date().toISOString(),
          stationsRemoved: count,
        });
      })
      .catch((err) => console.error("Failed to clear stations:", err));
  }, [stations.length, pushWithLog]);

  // ---- Suitability toggle ----
  const toggleSuitability = useCallback(() => {
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

  // ---- Planner: optimize ----
  const pendingGenerateLogRef = useRef<BuildLogEntry | null>(null);

  const runOptimize = useCallback(() => {
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
          min_thresholds: plannerConfig.minThresholds ?? {},
          existing_stations: stations.map((s) => ({ lat: s.lat, lng: s.lng, capacity: s.capacity })),
        });
        setPlannerCoverage(result.coverage); setGeneratedStations(result.stations);
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

  // ---- Planner: step ----
  const step = useCallback(() => {
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
          min_thresholds: plannerConfig.minThresholds ?? {},
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

  // ---- Planner: apply generated ----
  const applyStations = useCallback(() => {
    if (!generatedStations) return;
    const existingIds = new Set(stations.map((s) => s.id));
    const rekeyed = generatedStations.map((s, i) => {
      if (!existingIds.has(s.id)) return s;
      return { ...s, id: `gen_${Date.now()}_${i}` };
    });
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

  // ---- Seed LRT ----
  const seedLRT = useCallback((
    overlayData: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>,
    activeOverlays: Set<OverlayKey>,
  ) => {
    const lrtData = overlayData.lrt;
    if (!lrtData) return;
    const lrtPoints = lrtData.features.filter((f) => f.geometry.type === "Point");
    if (lrtPoints.length === 0) return;

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

    if (newStations.length === 0) return;
    pushWithLog([...stations, ...newStations], {
      action: "seed_lrt", timestamp: new Date().toISOString(),
      stationsAdded: newStations.map((s) => s.id),
    });
  }, [stations, pushWithLog]);

  // ---- Network lifecycle ----

  const loadNetwork = useCallback((network: SavedNetwork) => {
    undoRedo.reset({ stations: network.stations, buildLog: network.buildLog ?? [] });
    setPlannerConfig(network.plannerConfig);
    setPlannerWeights({ ...ZERO_WEIGHTS, ...network.plannerWeights });
    setDecayRadii({ ...DEFAULT_DECAY_RADII, ...network.decayRadii });
    setDensityScales({ ...DEFAULT_DENSITY_SCALES, ...network.densityScales });
    setActiveNetworkId(network.id);
    setActiveNetworkName(network.name);
    setGeneratedStations(null);
    setPlannerCoverage(null);
    setOptimizeError(null);
    initialLoadRef.current = true;
    saveStations(network.stations).catch((err) => console.error("Failed to sync loaded stations:", err));
  }, [undoRedo]);

  const loadNetworkById = useCallback(async (id: string): Promise<boolean> => {
    // Try localStorage first
    const local = getSavedNetwork(id);
    if (local) {
      loadNetwork(local);
      return true;
    }
    // Try server (shared network)
    try {
      const shared = await getSharedNetwork(id);
      if (shared?.data) {
        const imported: SavedNetwork = {
          ...shared.data,
          id,
          name: shared.name,
          savedAt: new Date().toISOString(),
        };
        persistNetwork(imported);
        loadNetwork(imported);
        return true;
      }
    } catch {
      // Not found
    }
    return false;
  }, [loadNetwork]);

  const newNetwork = useCallback(() => {
    undoRedo.reset({ stations: [], buildLog: [] });
    setPlannerWeights({ ...ZERO_WEIGHTS });
    setDecayRadii({ ...DEFAULT_DECAY_RADII });
    setDensityScales({ ...DEFAULT_DENSITY_SCALES });
    setPlannerConfig({ ...DEFAULT_PLANNER_CONFIG });
    setActiveNetworkId(null);
    setActiveNetworkName("Untitled Network");
    setGeneratedStations(null);
    setPlannerCoverage(null);
    setOptimizeError(null);
    initialLoadRef.current = true;
    apiClearStations().catch(console.error);
  }, [undoRedo]);

  const saveCurrentNetwork = useCallback(() => {
    if (activeNetworkId) {
      const draft = buildDraft(activeNetworkId, activeNetworkName);
      persistNetwork(draft);
    }
  }, [activeNetworkId, activeNetworkName, buildDraft]);

  const saveAsNetwork = useCallback((name: string) => {
    const id = crypto.randomUUID();
    const finalName = name.trim() || `Network \u2013 ${stations.length} stations`;
    const draft = buildDraft(id, finalName);
    persistNetwork(draft);
    setActiveNetworkId(id);
    setActiveNetworkName(finalName);
    initialLoadRef.current = true;
  }, [stations.length, buildDraft]);

  const renameNetwork = useCallback((name: string) => {
    setActiveNetworkName(name);
    if (activeNetworkId) {
      const draft = buildDraft(activeNetworkId, name);
      persistNetwork(draft);
    }
  }, [activeNetworkId, buildDraft]);

  const revertToSnapshot = useCallback((snapshotStations: BikeStation[], truncatedLog: BuildLogEntry[]) => {
    undoRedo.push({ stations: snapshotStations, buildLog: truncatedLog });
    saveStations(snapshotStations).catch((err) => console.error("Failed to sync reverted stations:", err));
    setGeneratedStations(null);
    setPlannerCoverage(null);
  }, [undoRedo]);

  // ---- Context value ----
  const value: NetworkContextValue = {
    activeNetworkId,
    activeNetworkName,
    stations,
    buildLog,
    plannerConfig,
    setPlannerConfig,
    plannerWeights,
    setPlannerWeights,
    decayRadii,
    setDecayRadii,
    densityScales,
    setDensityScales,
    generatedStations,
    plannerCoverage,
    optimizeError,
    isOptimizing,
    isStepping,
    suitabilityData,
    showSuitability,
    isSuitabilityLoading,
    toggleSuitability,
    addStationAt,
    deleteStation,
    updateStation,
    commitStation,
    moveStation,
    resetStations,
    undo: undoRedo.undo,
    redo: undoRedo.redo,
    canUndo: undoRedo.canUndo,
    canRedo: undoRedo.canRedo,
    runOptimize,
    step,
    applyStations,
    seedLRT,
    loadNetworkById,
    loadNetwork,
    newNetwork,
    saveCurrentNetwork,
    saveAsNetwork,
    renameNetwork,
    buildDraft,
    revertToSnapshot,
    lastAutoSaveAt,
  };

  return (
    <NetworkContext.Provider value={value}>
      {children}
    </NetworkContext.Provider>
  );
}
