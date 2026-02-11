"use client";

import { useCallback, useMemo, useState } from "react";
import type {
  BuildLogEntry,
  BuildLogStep,
  BuildLogGenerateAll,
  BuildLogParams,
  BikeStation,
  PlannerWeights,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface BuildHistoryProps {
  buildLog: BuildLogEntry[];
  stations: BikeStation[];
  /** Called when the user selects a point in history to preview. null = show current. */
  onPreviewSnapshot: (stations: BikeStation[] | null) => void;
}

// ---------------------------------------------------------------------------
// Action metadata (icon, colour, label)
// ---------------------------------------------------------------------------

interface ActionMeta {
  label: string;
  icon: React.ReactNode;
  color: string;
  bg: string;
}

const ICONS = {
  manualPlace: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z" /><circle cx="12" cy="10" r="3" />
    </svg>
  ),
  step: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" fill="currentColor" /><line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  ),
  generate: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
    </svg>
  ),
  apply: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 6L9 17l-5-5" />
    </svg>
  ),
  seedLrt: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="3" width="16" height="13" rx="2" /><line x1="4" y1="11" x2="20" y2="11" /><path d="M9 16l-2 5M15 16l2 5" />
    </svg>
  ),
  delete: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" /><path d="M10 11v6M14 11v6" />
    </svg>
  ),
  move: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 9l-3 3 3 3M9 5l3-3 3 3M15 19l-3 3-3-3M19 9l3 3-3 3" /><line x1="2" y1="12" x2="22" y2="12" /><line x1="12" y1="2" x2="12" y2="22" />
    </svg>
  ),
  clear: (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
};

function actionMeta(entry: BuildLogEntry): ActionMeta {
  switch (entry.action) {
    case "manual_place":
      return { label: "Placed station", icon: ICONS.manualPlace, color: "#1a73e8", bg: "#e8f0fe" };
    case "step":
      return { label: "Algorithmic step", icon: ICONS.step, color: "#1a73e8", bg: "#e8f0fe" };
    case "generate_all":
      return { label: `Generated ${entry.stationsAdded.length} stations`, icon: ICONS.generate, color: "#e65100", bg: "#fff3e0" };
    case "apply_generated":
      return { label: `Applied ${entry.stationsAdded.length} stations`, icon: ICONS.apply, color: "#34a853", bg: "#e8f5e9" };
    case "seed_lrt":
      return { label: `Seeded ${entry.stationsAdded.length} LRT docks`, icon: ICONS.seedLrt, color: "#7b1fa2", bg: "#f3e5f5" };
    case "delete_station":
      return { label: `Deleted "${entry.stationName}"`, icon: ICONS.delete, color: "#d32f2f", bg: "#fde7e7" };
    case "move_station":
      return { label: "Moved station", icon: ICONS.move, color: "#78909c", bg: "#eceff1" };
    case "clear_all":
      return { label: `Cleared ${entry.stationsRemoved} stations`, icon: ICONS.clear, color: "#d32f2f", bg: "#fde7e7" };
  }
}

// ---------------------------------------------------------------------------
// Weight bar (mini sparkline of factor weights)
// ---------------------------------------------------------------------------

const FACTOR_COLORS: Record<string, string> = {
  population: "#e53935", commercial: "#e65100", education: "#283593",
  recreation: "#2e7d32", lrt: "#7b1fa2", bike_infra: "#00838f", transit: "#0277bd",
};

function WeightBar({ weights }: { weights: PlannerWeights }) {
  const factors = Object.entries(weights).filter(([, v]) => v > 0);
  if (factors.length === 0) return <span className="text-[9px] text-[var(--color-secondary)] italic">all weights zero</span>;
  return (
    <div className="flex items-center gap-0.5">
      {factors.map(([key, val]) => (
        <div
          key={key}
          title={`${key}: ${val}`}
          className="rounded-sm"
          style={{
            width: Math.max(4, (val / 100) * 32),
            height: 6,
            backgroundColor: FACTOR_COLORS[key] ?? "#9aa0a6",
            opacity: 0.7 + (val / 100) * 0.3,
          }}
        />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Params detail panel
// ---------------------------------------------------------------------------

function ParamsDetail({ params }: { params: BuildLogParams }) {
  const activeWeights = Object.entries(params.weights).filter(([, v]) => v > 0);
  return (
    <div className="mt-2 space-y-2 text-[10px]">
      {/* Weights */}
      <div>
        <p className="font-semibold text-[var(--color-secondary)] uppercase tracking-wider mb-1">Factor Weights</p>
        {activeWeights.length === 0 ? (
          <p className="text-[var(--color-secondary)] italic">All weights at zero</p>
        ) : (
          <div className="space-y-0.5">
            {activeWeights.map(([key, val]) => (
              <div key={key} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: FACTOR_COLORS[key] ?? "#9aa0a6" }} />
                <span className="flex-1 text-[var(--color-fg)] capitalize">{key.replace(/_/g, " ")}</span>
                <span className="text-[var(--color-fg)] font-medium tabular-nums">{val}</span>
                <div className="w-16 h-1.5 rounded-full bg-[#e0e0e0] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${val}%`, backgroundColor: FACTOR_COLORS[key] ?? "#9aa0a6" }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Decay radii */}
      <div>
        <p className="font-semibold text-[var(--color-secondary)] uppercase tracking-wider mb-1">Reach Distances</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {Object.entries(params.decayRadii).map(([key, val]) => (
            <span key={key} className="text-[var(--color-fg)]">
              <span className="capitalize">{key.replace(/_/g, " ")}</span>: <span className="font-medium tabular-nums">{val >= 1000 ? `${(val / 1000).toFixed(1)}km` : `${val}m`}</span>
            </span>
          ))}
        </div>
      </div>
      {/* Key config */}
      <div>
        <p className="font-semibold text-[var(--color-secondary)] uppercase tracking-wider mb-1">Spacing & Connectivity</p>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[var(--color-fg)]">
          <span>Spacing: <span className="font-medium tabular-nums">{params.config.minSpacingM}m</span></span>
          <span>Prox: <span className="font-medium tabular-nums">{params.config.proximityDiscountRadius}m @ {params.config.proximityDiscountStrength}%</span></span>
          <span>Connect: <span className="font-medium tabular-nums">{params.config.connectivityRadius}m @ {params.config.connectivityStrength}%</span></span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Replay bar
// ---------------------------------------------------------------------------

function ReplayBar({
  total,
  current,
  isPlaying,
  onSeek,
  onPlay,
  onPause,
  onReset,
}: {
  total: number;
  current: number;
  isPlaying: boolean;
  onSeek: (idx: number) => void;
  onPlay: () => void;
  onPause: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-2 bg-[#f8f9fa] border-b border-[var(--color-border)]">
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--color-blue)] text-white hover:bg-[#1557b0] transition-colors"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
          </svg>
        ) : (
          <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3" />
          </svg>
        )}
      </button>
      <input
        type="range"
        min={0}
        max={total}
        value={current}
        onChange={(e) => onSeek(Number(e.target.value))}
        className="flex-1 h-1 rounded-full appearance-none cursor-pointer"
        style={{
          background: total > 0
            ? `linear-gradient(to right, var(--color-blue) ${(current / total) * 100}%, #e0e0e0 ${(current / total) * 100}%)`
            : "#e0e0e0",
          accentColor: "var(--color-blue)",
        }}
      />
      <span className="text-[10px] font-medium text-[var(--color-fg)] tabular-nums w-10 text-right">
        {current}/{total}
      </span>
      <button
        onClick={onReset}
        className="text-[10px] font-medium text-[var(--color-secondary)] hover:text-[var(--color-fg)] transition-colors"
        title="Show current state"
      >
        Live
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function BuildHistory({ buildLog, stations, onPreviewSnapshot }: BuildHistoryProps) {
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);
  const [replayIdx, setReplayIdx] = useState<number | null>(null); // null = live
  const [isPlaying, setIsPlaying] = useState(false);
  const playTimerRef = useMemo(() => ({ current: null as ReturnType<typeof setInterval> | null }), []);

  // -----------------------------------------------------------------------
  // Compute station snapshots at each build log entry
  // We replay the build log forward to know what the station list looked like
  // at each point. For bulk actions (seed_lrt, apply_generated) we look up
  // station data by ID from the final stations array.
  // -----------------------------------------------------------------------
  const stationById = useMemo(() => {
    const map = new Map<string, BikeStation>();
    for (const s of stations) map.set(s.id, s);
    return map;
  }, [stations]);

  const snapshots = useMemo(() => {
    const result: BikeStation[][] = [];
    let current: BikeStation[] = [];

    for (const entry of buildLog) {
      switch (entry.action) {
        case "manual_place":
          current = [...current, stationById.get(entry.stationId) ?? {
            id: entry.stationId, name: `Station`, lat: entry.lat, lng: entry.lng,
            capacity: 20, bikes: 10,
          }];
          break;
        case "step":
          current = [...current, stationById.get(entry.stationId) ?? {
            id: entry.stationId, name: `Station`, lat: entry.resultLat, lng: entry.resultLng,
            capacity: entry.resultCapacity, bikes: Math.round(entry.resultCapacity * 0.5),
          }];
          break;
        case "seed_lrt":
        case "apply_generated": {
          // Look up each added station by ID from the final stations array
          const added = entry.stationsAdded
            .map((id) => stationById.get(id))
            .filter((s): s is BikeStation => s != null);
          current = [...current, ...added];
          break;
        }
        case "generate_all":
          // Generated stations aren't applied until apply_generated
          break;
        case "delete_station":
          current = current.filter((s) => s.id !== entry.stationId);
          break;
        case "move_station":
          current = current.map((s) =>
            s.id === entry.stationId ? { ...s, lat: entry.toLat, lng: entry.toLng } : s,
          );
          break;
        case "clear_all":
          current = [];
          break;
      }
      result.push(current);
    }
    return result;
  }, [buildLog, stationById]);

  // -----------------------------------------------------------------------
  // Replay controls
  // -----------------------------------------------------------------------
  const handleSeek = useCallback((idx: number) => {
    if (idx >= buildLog.length) {
      setReplayIdx(null);
      onPreviewSnapshot(null);
    } else {
      setReplayIdx(idx);
      onPreviewSnapshot(snapshots[idx] ?? null);
    }
  }, [buildLog.length, snapshots, onPreviewSnapshot]);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    const startIdx = replayIdx ?? -1;
    let currentIdx = startIdx;

    playTimerRef.current = setInterval(() => {
      currentIdx++;
      if (currentIdx >= buildLog.length) {
        if (playTimerRef.current) clearInterval(playTimerRef.current);
        setIsPlaying(false);
        setReplayIdx(null);
        onPreviewSnapshot(null);
        return;
      }
      setReplayIdx(currentIdx);
      onPreviewSnapshot(snapshots[currentIdx] ?? null);
    }, 600);
  }, [replayIdx, buildLog.length, snapshots, onPreviewSnapshot, playTimerRef]);

  const handlePause = useCallback(() => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    setIsPlaying(false);
  }, [playTimerRef]);

  const handleReset = useCallback(() => {
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    setIsPlaying(false);
    setReplayIdx(null);
    onPreviewSnapshot(null);
  }, [onPreviewSnapshot, playTimerRef]);

  // Cleanup on unmount
  // (using useMemo ref pattern to avoid adding effect dep)
  // eslint-disable-next-line react-hooks/exhaustive-deps

  if (buildLog.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center mb-3">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
          </svg>
        </div>
        <p className="text-[13px] font-medium text-[var(--color-fg)] mb-1">
          No build history yet
        </p>
        <p className="text-[12px] text-[var(--color-secondary)] leading-relaxed max-w-[240px]">
          As you place stations, run the optimizer, or seed LRT docks, every action will be recorded here.
        </p>
      </div>
    );
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Replay bar */}
      <ReplayBar
        total={buildLog.length}
        current={replayIdx !== null ? replayIdx + 1 : buildLog.length}
        isPlaying={isPlaying}
        onSeek={(v) => handleSeek(v - 1)}
        onPlay={handlePlay}
        onPause={handlePause}
        onReset={handleReset}
      />

      {/* Replay indicator */}
      {replayIdx !== null && (
        <div className="px-4 py-1.5 bg-[#fff8e1] border-b border-[#ffe082] flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#f9a825] animate-pulse" />
          <span className="text-[10px] font-medium text-[#f57f17]">
            Viewing step {replayIdx + 1} of {buildLog.length}
          </span>
          <div className="flex-1" />
          <button
            onClick={handleReset}
            className="text-[10px] font-medium text-[#f57f17] hover:text-[#e65100] transition-colors"
          >
            Return to live
          </button>
        </div>
      )}

      {/* Summary stats */}
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-white">
        <div className="flex items-center gap-3 text-[11px]">
          <span className="text-[var(--color-fg)] font-medium">{buildLog.length} actions</span>
          <span className="text-[var(--color-secondary)]">{stations.length} stations</span>
          {buildLog.length > 0 && (
            <span className="text-[var(--color-secondary)]">
              {fmtTime(buildLog[0].timestamp)} &ndash; {fmtTime(buildLog[buildLog.length - 1].timestamp)}
            </span>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="flex-1 overflow-y-auto">
        {buildLog.map((entry, idx) => {
          const meta = actionMeta(entry);
          const isExpanded = expandedIdx === idx;
          const hasParams = entry.action === "step" || entry.action === "generate_all";
          const isHighlighted = replayIdx === idx;

          return (
            <div
              key={idx}
              className={`relative transition-colors ${isHighlighted ? "bg-[#e8f0fe]" : "hover:bg-[var(--color-surface-hover)]"}`}
            >
              {/* Timeline line */}
              <div className="absolute left-[23px] top-0 bottom-0 w-px bg-[var(--color-border)]" />

              <div
                className="flex items-start gap-2.5 px-4 py-2 cursor-pointer"
                onClick={() => {
                  setExpandedIdx(isExpanded ? null : idx);
                  handleSeek(idx);
                }}
              >
                {/* Timeline dot */}
                <div
                  className="relative z-10 w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: meta.bg, color: meta.color }}
                >
                  {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-medium text-[var(--color-fg)] truncate">
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-[var(--color-secondary)] tabular-nums shrink-0">
                      {fmtTime(entry.timestamp)}
                    </span>
                  </div>

                  {/* Brief detail line */}
                  {entry.action === "step" && (
                    <div className="mt-0.5">
                      <WeightBar weights={(entry as BuildLogStep).params.weights} />
                    </div>
                  )}
                  {entry.action === "generate_all" && (
                    <div className="mt-0.5 flex items-center gap-2">
                      <WeightBar weights={(entry as BuildLogGenerateAll).params.weights} />
                      <span className="text-[9px] text-[var(--color-secondary)] tabular-nums">
                        {(entry as BuildLogGenerateAll).solveTimeS.toFixed(1)}s
                      </span>
                    </div>
                  )}

                  {/* Expanded params */}
                  {isExpanded && hasParams && (
                    <ParamsDetail
                      params={
                        entry.action === "step"
                          ? (entry as BuildLogStep).params
                          : (entry as BuildLogGenerateAll).params
                      }
                    />
                  )}
                  {isExpanded && entry.action === "generate_all" && (
                    <div className="mt-2 text-[10px] text-[var(--color-fg)]">
                      <p className="font-semibold text-[var(--color-secondary)] uppercase tracking-wider mb-1">Coverage Results</p>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                        <span>Demand: <span className="font-medium">{(entry as BuildLogGenerateAll).coverage.demand_covered_pct}%</span></span>
                        {(entry as BuildLogGenerateAll).coverage.population_covered_pct !== undefined && (
                          <span>Pop: <span className="font-medium">{(entry as BuildLogGenerateAll).coverage.population_covered_pct}%</span></span>
                        )}
                        <span>Docks: <span className="font-medium tabular-nums">{(entry as BuildLogGenerateAll).coverage.total_docks}</span></span>
                        <span>Bikes: <span className="font-medium tabular-nums">{(entry as BuildLogGenerateAll).coverage.total_bikes}</span></span>
                      </div>
                    </div>
                  )}
                  {isExpanded && entry.action === "step" && (
                    <div className="mt-1.5 text-[10px] text-[var(--color-secondary)]">
                      Placed at {(entry as BuildLogStep).resultLat.toFixed(5)}, {(entry as BuildLogStep).resultLng.toFixed(5)} &middot; {(entry as BuildLogStep).resultCapacity} docks
                    </div>
                  )}
                  {isExpanded && entry.action === "manual_place" && (
                    <div className="mt-1 text-[10px] text-[var(--color-secondary)]">
                      At {entry.lat.toFixed(5)}, {entry.lng.toFixed(5)}
                    </div>
                  )}
                  {isExpanded && entry.action === "move_station" && (
                    <div className="mt-1 text-[10px] text-[var(--color-secondary)]">
                      From {entry.fromLat.toFixed(5)}, {entry.fromLng.toFixed(5)} &rarr; {entry.toLat.toFixed(5)}, {entry.toLng.toFixed(5)}
                    </div>
                  )}
                </div>

                {/* Expand indicator */}
                {hasParams && (
                  <svg
                    width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6"
                    strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                    className={`shrink-0 mt-1 transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
