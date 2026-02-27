"use client";

import { useCallback, useMemo, useState } from "react";
import {
  MapPin,
  SkipForward,
  Zap,
  Check,
  TrainFront,
  Trash2,
  Move,
  X,
  Clock,
  Play,
  Pause,
  ChevronDown,
} from "lucide-react";
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
  /** Called when the user wants to revert the network to a specific point in history.
   *  Receives the snapshot stations and the truncated build log (up to and including the selected entry). */
  onRevertToSnapshot: (stations: BikeStation[], buildLog: BuildLogEntry[]) => void;
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
  manualPlace: <MapPin size={12} />,
  step: <SkipForward size={12} />,
  generate: <Zap size={12} />,
  apply: <Check size={12} strokeWidth={2.5} />,
  seedLrt: <TrainFront size={12} />,
  delete: <Trash2 size={12} />,
  move: <Move size={12} />,
  clear: <X size={12} />,
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
                <div className="w-16 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
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
    <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface-alt)] border-b border-[var(--color-border)]">
      <button
        onClick={isPlaying ? onPause : onPlay}
        className="w-6 h-6 rounded-full flex items-center justify-center bg-[var(--color-blue)] text-white hover:bg-[var(--color-blue-hover)] transition-colors"
        title={isPlaying ? "Pause" : "Play"}
      >
        {isPlaying ? <Pause size={10} /> : <Play size={10} />}
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

export default function BuildHistory({ buildLog, stations, onPreviewSnapshot, onRevertToSnapshot }: BuildHistoryProps) {
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

  const handleRevert = useCallback(() => {
    if (replayIdx === null) return;
    const snapshotStations = snapshots[replayIdx] ?? [];
    const truncatedLog = buildLog.slice(0, replayIdx + 1);
    // Exit replay mode
    if (playTimerRef.current) clearInterval(playTimerRef.current);
    setIsPlaying(false);
    setReplayIdx(null);
    onPreviewSnapshot(null);
    // Commit the revert
    onRevertToSnapshot(snapshotStations, truncatedLog);
  }, [replayIdx, snapshots, buildLog, onPreviewSnapshot, onRevertToSnapshot, playTimerRef]);

  if (buildLog.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-12 h-12 rounded-full bg-[var(--color-surface-hover)] flex items-center justify-center mb-3">
          <Clock size={24} className="text-[var(--color-secondary)]" />
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
            onClick={handleRevert}
            className="text-[10px] font-medium text-white bg-[#e65100] hover:bg-[#bf360c] rounded px-2 py-0.5 transition-colors"
            title="Discard all actions after this point and revert the network to this state"
          >
            Revert to here
          </button>
          <button
            onClick={handleReset}
            className="text-[10px] font-medium text-[#f57f17] hover:text-[#e65100] transition-colors"
          >
            Return to live
          </button>
        </div>
      )}

      {/* Summary stats */}
      <div className="px-4 py-2.5 border-b border-[var(--color-border)] bg-[var(--color-surface)]">
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
              className={`relative transition-colors ${isHighlighted ? "bg-[var(--color-active-bg)]" : "hover:bg-[var(--color-surface-hover)]"}`}
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
                  <ChevronDown
                    size={10}
                    className={`shrink-0 mt-1 text-[var(--color-secondary)] transition-transform duration-150 ${isExpanded ? "rotate-180" : ""}`}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
