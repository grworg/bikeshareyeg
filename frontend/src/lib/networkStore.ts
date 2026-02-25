import { create } from "zustand";
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

// ---------------------------------------------------------------------------
// Constants
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

const MAX_HISTORY = 200;

// ---------------------------------------------------------------------------
// Undo/redo state shape
// ---------------------------------------------------------------------------

interface UndoState {
  stations: BikeStation[];
  buildLog: BuildLogEntry[];
}

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

interface NetworkStore {
  // Undo/redo internals
  _past: UndoState[];
  _future: UndoState[];
  _anchor: UndoState;

  // Current state (the "present" of undo/redo)
  stations: BikeStation[];
  buildLog: BuildLogEntry[];

  // Identity
  activeNetworkId: string | null;
  activeNetworkName: string;

  // Planner config
  plannerConfig: PlannerConfig;
  plannerWeights: PlannerWeights;
  decayRadii: PlannerDecayRadii;
  densityScales: PlannerDensityScales;

  // Planner results
  generatedStations: BikeStation[] | null;
  plannerCoverage: PlannerCoverage | null;
  optimizeError: string | null;
  isOptimizing: boolean;
  isStepping: boolean;

  // Suitability
  suitabilityData: GeoJSON.FeatureCollection | null;
  showSuitability: boolean;
  isSuitabilityLoading: boolean;

  // Auto-save
  lastAutoSaveAt: string | null;
  _autoSaveTimer: ReturnType<typeof setTimeout> | null;
  _initialLoad: boolean;

  // Backend sync
  _syncTimer: ReturnType<typeof setTimeout> | null;

  // Pending generate log entry (stashed for apply)
  _pendingGenerateLog: BuildLogEntry | null;

  // Undo/redo actions
  push: (next: UndoState) => void;
  replace: (next: UndoState) => void;
  commit: () => void;
  undo: () => void;
  redo: () => void;
  resetHistory: (initial: UndoState) => void;
  canUndo: () => boolean;
  canRedo: () => boolean;

  // Station mutations
  addStationAt: (lngLat: { lng: number; lat: number }) => string;
  deleteStation: (id: string) => void;
  updateStation: (id: string, updates: Partial<BikeStation>) => void;
  commitStation: () => void;
  moveStation: (stationId: string, lngLat: { lng: number; lat: number }) => void;
  resetStations: () => void;

  // Planner config setters
  setPlannerConfig: (c: PlannerConfig) => void;
  setPlannerWeights: (w: PlannerWeights) => void;
  setDecayRadii: (r: PlannerDecayRadii) => void;
  setDensityScales: (d: PlannerDensityScales) => void;

  // Suitability
  toggleSuitability: () => void;
  loadSuitabilityData: () => void;

  // Planner actions
  runOptimize: () => void;
  step: () => void;
  applyStations: () => void;
  seedLRT: (overlayData: Partial<Record<OverlayKey, GeoJSON.FeatureCollection>>) => number;

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

  // Init (call once from layout)
  init: () => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let stationCounter = 100;

function syncToBackend(store: NetworkStore) {
  if (store._syncTimer) clearTimeout(store._syncTimer);
  const timer = setTimeout(() => {
    saveStations(store.stations).catch((err) => console.error("Failed to sync stations:", err));
  }, 500);
  useNetworkStore.setState({ _syncTimer: timer });
}

function scheduleAutoSave(store: NetworkStore) {
  if (!store.activeNetworkId) return;
  if (store._initialLoad) return;
  if (store._autoSaveTimer) clearTimeout(store._autoSaveTimer);
  const timer = setTimeout(() => {
    const s = useNetworkStore.getState();
    if (!s.activeNetworkId) return;
    const draft = s.buildDraft(s.activeNetworkId, s.activeNetworkName);
    persistNetwork(draft);
    useNetworkStore.setState({ lastAutoSaveAt: new Date().toISOString() });
  }, 1500);
  useNetworkStore.setState({ _autoSaveTimer: timer });
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

const EMPTY: UndoState = { stations: [], buildLog: [] };

export const useNetworkStore = create<NetworkStore>((set, get) => ({
  // ---- Undo/redo internals ----
  _past: [],
  _future: [],
  _anchor: EMPTY,

  // ---- Current state ----
  stations: [],
  buildLog: [],

  // ---- Identity ----
  activeNetworkId: null,
  activeNetworkName: "Untitled Network",

  // ---- Planner config ----
  plannerConfig: { ...DEFAULT_PLANNER_CONFIG },
  plannerWeights: { ...ZERO_WEIGHTS },
  decayRadii: { ...DEFAULT_DECAY_RADII },
  densityScales: { ...DEFAULT_DENSITY_SCALES },

  // ---- Planner results ----
  generatedStations: null,
  plannerCoverage: null,
  optimizeError: null,
  isOptimizing: false,
  isStepping: false,

  // ---- Suitability ----
  suitabilityData: null,
  showSuitability: true,
  isSuitabilityLoading: false,

  // ---- Auto-save ----
  lastAutoSaveAt: null,
  _autoSaveTimer: null,
  _initialLoad: true,

  // ---- Backend sync ----
  _syncTimer: null,

  // ---- Pending generate log ----
  _pendingGenerateLog: null,

  // ===========================================================================
  // Undo/redo
  // ===========================================================================

  push: (next) => {
    const { _past, stations, buildLog } = get();
    const present: UndoState = { stations, buildLog };
    set({
      _past: [..._past, present].slice(-MAX_HISTORY),
      _future: [],
      _anchor: next,
      stations: next.stations,
      buildLog: next.buildLog,
    });
    syncToBackend({ ...get(), stations: next.stations });
    scheduleAutoSave(get());
  },

  replace: (next) => {
    set({ stations: next.stations, buildLog: next.buildLog });
  },

  commit: () => {
    const { _past, _anchor, stations, buildLog } = get();
    const present: UndoState = { stations, buildLog };
    if (present === _anchor) return;
    set({
      _past: [..._past, _anchor].slice(-MAX_HISTORY),
      _future: [],
      _anchor: present,
    });
    syncToBackend(get());
    scheduleAutoSave(get());
  },

  undo: () => {
    const { _past, _future, stations, buildLog } = get();
    if (_past.length === 0) return;
    const prev = _past[_past.length - 1];
    set({
      _past: _past.slice(0, -1),
      _future: [{ stations, buildLog }, ..._future].slice(0, MAX_HISTORY),
      _anchor: prev,
      stations: prev.stations,
      buildLog: prev.buildLog,
    });
    syncToBackend({ ...get(), stations: prev.stations });
    scheduleAutoSave(get());
  },

  redo: () => {
    const { _past, _future, stations, buildLog } = get();
    if (_future.length === 0) return;
    const next = _future[0];
    set({
      _past: [..._past, { stations, buildLog }].slice(-MAX_HISTORY),
      _future: _future.slice(1),
      _anchor: next,
      stations: next.stations,
      buildLog: next.buildLog,
    });
    syncToBackend({ ...get(), stations: next.stations });
    scheduleAutoSave(get());
  },

  resetHistory: (initial) => {
    set({
      _past: [],
      _future: [],
      _anchor: initial,
      stations: initial.stations,
      buildLog: initial.buildLog,
    });
  },

  canUndo: () => get()._past.length > 0,
  canRedo: () => get()._future.length > 0,

  // ===========================================================================
  // Station mutations
  // ===========================================================================

  addStationAt: (lngLat) => {
    stationCounter++;
    const { stations, buildLog } = get();
    const newStation: BikeStation = {
      id: `s_new_${stationCounter}`,
      name: `New Station ${stationCounter - 100}`,
      lat: lngLat.lat, lng: lngLat.lng, capacity: 20, bikes: 10,
    };
    get().push({
      stations: [...stations, newStation],
      buildLog: [...buildLog, {
        action: "manual_place", timestamp: new Date().toISOString(),
        stationId: newStation.id, lat: lngLat.lat, lng: lngLat.lng,
      }],
    });
    return newStation.id;
  },

  deleteStation: (id) => {
    const { stations, buildLog } = get();
    const station = stations.find((s) => s.id === id);
    get().push({
      stations: stations.filter((s) => s.id !== id),
      buildLog: [...buildLog, {
        action: "delete_station", timestamp: new Date().toISOString(),
        stationId: id, stationName: station?.name ?? id,
      }],
    });
  },

  updateStation: (id, updates) => {
    const { stations, buildLog } = get();
    get().replace({
      stations: stations.map((s) => (s.id === id ? { ...s, ...updates } : s)),
      buildLog,
    });
  },

  commitStation: () => get().commit(),

  moveStation: (stationId, lngLat) => {
    const { stations, buildLog } = get();
    const prev = stations.find((s) => s.id === stationId);
    const updated = stations.map((s) =>
      s.id === stationId ? { ...s, lat: lngLat.lat, lng: lngLat.lng } : s,
    );
    if (prev) {
      get().push({
        stations: updated,
        buildLog: [...buildLog, {
          action: "move_station", timestamp: new Date().toISOString(),
          stationId, fromLat: prev.lat, fromLng: prev.lng,
          toLat: lngLat.lat, toLng: lngLat.lng,
        }],
      });
    } else {
      get().push({ stations: updated, buildLog });
    }
  },

  resetStations: () => {
    const { stations, buildLog } = get();
    const count = stations.length;
    apiClearStations()
      .then((s) => {
        get().push({
          stations: s,
          buildLog: [...buildLog, {
            action: "clear_all", timestamp: new Date().toISOString(),
            stationsRemoved: count,
          }],
        });
      })
      .catch((err) => console.error("Failed to clear stations:", err));
  },

  // ===========================================================================
  // Planner config setters
  // ===========================================================================

  setPlannerConfig: (c) => { set({ plannerConfig: c }); scheduleAutoSave(get()); },
  setPlannerWeights: (w) => { set({ plannerWeights: w }); scheduleAutoSave(get()); },
  setDecayRadii: (r) => { set({ decayRadii: r }); scheduleAutoSave(get()); },
  setDensityScales: (d) => { set({ densityScales: d }); scheduleAutoSave(get()); },

  // ===========================================================================
  // Suitability
  // ===========================================================================

  toggleSuitability: () => {
    const { showSuitability, suitabilityData, isSuitabilityLoading } = get();
    const next = !showSuitability;
    set({ showSuitability: next });
    if (next && !suitabilityData && !isSuitabilityLoading) {
      get().loadSuitabilityData();
    }
  },

  loadSuitabilityData: () => {
    const { suitabilityData, isSuitabilityLoading } = get();
    if (suitabilityData || isSuitabilityLoading) return;
    set({ isSuitabilityLoading: true });
    getPlannerHexGrid()
      .then((data) => set({ suitabilityData: data }))
      .catch((err) => { console.error("Failed to load suitability hex grid:", err); set({ showSuitability: false }); })
      .finally(() => set({ isSuitabilityLoading: false }));
  },

  // ===========================================================================
  // Planner actions
  // ===========================================================================

  runOptimize: () => {
    set({ isOptimizing: true, optimizeError: null, plannerCoverage: null, generatedStations: null, _pendingGenerateLog: null });

    const doOptimize = async () => {
      const s = get();
      try {
        if (!s.suitabilityData) {
          const hexData = await getPlannerHexGrid();
          set({ suitabilityData: hexData });
        }
        const cfg = s.plannerConfig;
        const result = await runPlannerOptimize({
          algorithm: cfg.algorithm, batch_size: cfg.batchSize,
          num_stations: cfg.numStations, coverage_radius_m: cfg.coverageRadiusM,
          min_spacing_m: cfg.minSpacingM, total_bikes: cfg.totalBikes,
          min_docks_per_station: cfg.minDocksPerStation, max_docks_per_station: cfg.maxDocksPerStation,
          target_fill_pct: cfg.targetFillPct,
          proximity_discount_radius: cfg.proximityDiscountRadius,
          proximity_discount_strength: cfg.proximityDiscountStrength,
          connectivity_radius: cfg.connectivityRadius,
          connectivity_strength: cfg.connectivityStrength,
          decay_radii: s.decayRadii, density_scales: s.densityScales, weights: s.plannerWeights,
          min_thresholds: cfg.minThresholds ?? {},
          existing_stations: s.stations.map((st) => ({ lat: st.lat, lng: st.lng, capacity: st.capacity })),
        });
        const params: BuildLogParams = {
          weights: { ...s.plannerWeights }, decayRadii: { ...s.decayRadii },
          densityScales: { ...s.densityScales }, config: { ...cfg },
        };
        set({
          plannerCoverage: result.coverage,
          generatedStations: result.stations,
          _pendingGenerateLog: {
            action: "generate_all", timestamp: new Date().toISOString(),
            stationsAdded: result.stations.map((st) => st.id),
            params, coverage: result.coverage, solveTimeS: result.solve_time_s,
          },
        });
      } catch (err) {
        console.error("Optimization failed:", err);
        set({ optimizeError: err instanceof Error ? err.message : String(err) });
      } finally { set({ isOptimizing: false }); }
    };
    doOptimize();
  },

  step: () => {
    set({ isStepping: true, optimizeError: null });

    const doStep = async () => {
      const s = get();
      try {
        if (!s.suitabilityData) {
          const hexData = await getPlannerHexGrid();
          set({ suitabilityData: hexData });
        }
        const cfg = s.plannerConfig;
        const result = await stepPlanner({
          min_spacing_m: cfg.minSpacingM,
          min_docks_per_station: cfg.minDocksPerStation,
          max_docks_per_station: cfg.maxDocksPerStation,
          target_fill_pct: cfg.targetFillPct,
          proximity_discount_radius: cfg.proximityDiscountRadius,
          proximity_discount_strength: cfg.proximityDiscountStrength,
          connectivity_radius: cfg.connectivityRadius,
          connectivity_strength: cfg.connectivityStrength,
          decay_radii: s.decayRadii, density_scales: s.densityScales, weights: s.plannerWeights,
          min_thresholds: cfg.minThresholds ?? {},
          existing_stations: s.stations.map((st) => ({ lat: st.lat, lng: st.lng, capacity: st.capacity })),
        });

        if (!result.station) {
          set({ optimizeError: result.message ?? "No viable location found" }); return;
        }

        const steppedCount = s.stations.filter((st) => st.id.startsWith("step_")).length;
        const newStation: BikeStation = {
          ...result.station, id: `step_${Date.now()}_${steppedCount}`, name: `Station ${s.stations.length + 1}`,
        };
        const params: BuildLogParams = {
          weights: { ...s.plannerWeights }, decayRadii: { ...s.decayRadii },
          densityScales: { ...s.densityScales }, config: { ...cfg },
        };
        const next = [...s.stations, newStation];
        get().push({
          stations: next,
          buildLog: [...s.buildLog, {
            action: "step", timestamp: new Date().toISOString(),
            stationId: newStation.id, params,
            resultLat: newStation.lat, resultLng: newStation.lng,
            resultCapacity: newStation.capacity,
          }],
        });
        saveStations(next).catch(console.error);
      } catch (err) {
        console.error("Step failed:", err);
        set({ optimizeError: err instanceof Error ? err.message : String(err) });
      } finally { set({ isStepping: false }); }
    };
    doStep();
  },

  applyStations: () => {
    const { generatedStations, stations, buildLog, _pendingGenerateLog } = get();
    if (!generatedStations) return;
    const existingIds = new Set(stations.map((s) => s.id));
    const rekeyed = generatedStations.map((s, i) => {
      if (!existingIds.has(s.id)) return s;
      return { ...s, id: `gen_${Date.now()}_${i}` };
    });
    const entries: BuildLogEntry[] = [];
    if (_pendingGenerateLog) entries.push(_pendingGenerateLog);
    entries.push({
      action: "apply_generated", timestamp: new Date().toISOString(),
      stationsAdded: rekeyed.map((s) => s.id),
    });
    get().push({
      stations: [...stations, ...rekeyed],
      buildLog: [...buildLog, ...entries],
    });
    set({ generatedStations: null, plannerCoverage: null, _pendingGenerateLog: null });
  },

  seedLRT: (overlayData) => {
    const lrtData = overlayData.lrt;
    if (!lrtData) return 0;
    const lrtPoints = lrtData.features.filter((f) => f.geometry.type === "Point");
    if (lrtPoints.length === 0) return 0;

    const { stations, buildLog } = get();
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

    if (newStations.length === 0) return 0;
    get().push({
      stations: [...stations, ...newStations],
      buildLog: [...buildLog, {
        action: "seed_lrt", timestamp: new Date().toISOString(),
        stationsAdded: newStations.map((s) => s.id),
      }],
    });
    return newStations.length;
  },

  // ===========================================================================
  // Network lifecycle
  // ===========================================================================

  loadNetwork: (network) => {
    get().resetHistory({ stations: network.stations, buildLog: network.buildLog ?? [] });
    set({
      plannerConfig: network.plannerConfig,
      plannerWeights: { ...ZERO_WEIGHTS, ...network.plannerWeights },
      decayRadii: { ...DEFAULT_DECAY_RADII, ...network.decayRadii },
      densityScales: { ...DEFAULT_DENSITY_SCALES, ...network.densityScales },
      activeNetworkId: network.id,
      activeNetworkName: network.name,
      generatedStations: null,
      plannerCoverage: null,
      optimizeError: null,
      _initialLoad: true,
    });
    // Mark initial load done after first tick so auto-save doesn't fire immediately
    setTimeout(() => set({ _initialLoad: false }), 100);
    saveStations(network.stations).catch((err) => console.error("Failed to sync loaded stations:", err));
  },

  loadNetworkById: async (id) => {
    const local = getSavedNetwork(id);
    if (local) {
      get().loadNetwork(local);
      return true;
    }
    try {
      const shared = await getSharedNetwork(id);
      if (shared?.data) {
        const imported: SavedNetwork = {
          ...shared.data, id,
          name: shared.name,
          savedAt: new Date().toISOString(),
        };
        persistNetwork(imported);
        get().loadNetwork(imported);
        return true;
      }
    } catch { /* not found */ }
    return false;
  },

  newNetwork: () => {
    get().resetHistory({ stations: [], buildLog: [] });
    set({
      plannerWeights: { ...ZERO_WEIGHTS },
      decayRadii: { ...DEFAULT_DECAY_RADII },
      densityScales: { ...DEFAULT_DENSITY_SCALES },
      plannerConfig: { ...DEFAULT_PLANNER_CONFIG },
      activeNetworkId: null,
      activeNetworkName: "Untitled Network",
      generatedStations: null,
      plannerCoverage: null,
      optimizeError: null,
      _initialLoad: true,
    });
    apiClearStations().catch(console.error);
  },

  saveCurrentNetwork: () => {
    const { activeNetworkId, activeNetworkName, buildDraft } = get();
    if (activeNetworkId) {
      persistNetwork(buildDraft(activeNetworkId, activeNetworkName));
    }
  },

  saveAsNetwork: (name) => {
    const id = crypto.randomUUID();
    const { stations, buildDraft } = get();
    const finalName = name.trim() || `Network \u2013 ${stations.length} stations`;
    persistNetwork(buildDraft(id, finalName));
    set({ activeNetworkId: id, activeNetworkName: finalName, _initialLoad: true });
    setTimeout(() => set({ _initialLoad: false }), 100);
  },

  renameNetwork: (name) => {
    const { activeNetworkId, buildDraft } = get();
    set({ activeNetworkName: name });
    if (activeNetworkId) persistNetwork(buildDraft(activeNetworkId, name));
  },

  buildDraft: (id, name) => {
    const s = get();
    return {
      version: 2 as const, id,
      name: name.trim() || `Network \u2013 ${s.stations.length} stations`,
      savedAt: new Date().toISOString(),
      stations: s.stations, plannerConfig: s.plannerConfig,
      plannerWeights: s.plannerWeights, decayRadii: s.decayRadii,
      densityScales: s.densityScales, buildLog: s.buildLog,
    };
  },

  revertToSnapshot: (snapshotStations, truncatedLog) => {
    get().push({ stations: snapshotStations, buildLog: truncatedLog });
    saveStations(snapshotStations).catch((err) => console.error("Failed to sync reverted stations:", err));
    set({ generatedStations: null, plannerCoverage: null });
  },

  // ===========================================================================
  // Init — load stations from backend + eagerly load suitability
  // ===========================================================================

  init: () => {
    getStations()
      .then((loaded) => get().resetHistory({ stations: loaded, buildLog: [] }))
      .catch((err) => console.error("Failed to load stations:", err));
    get().loadSuitabilityData();
  },
}));
