"use client";

import { useEffect, useRef } from "react";
import type { BikeStation, PlannerWeights, PlannerDecayRadii, PlannerDensityScales, PlannerConfig, PlannerCoverage } from "@/lib/types";
import PlannerControls from "@/components/PlannerControls";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface DesignerPanelProps {
  stations: BikeStation[];
  selectedStationId: string | null;
  /** If true, the name field will auto-focus + select-all (just-created station). */
  autoFocusName?: boolean;
  onSelectStation: (id: string | null) => void;
  onUpdateStation: (id: string, updates: Partial<BikeStation>) => void;
  /** Commit the current state to undo history (called when slider is released). */
  onCommitStation: () => void;
  onDeleteStation: (id: string) => void;
  onResetStations: () => void;
  onExitDesigner: () => void;
  // Undo / Redo
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  // Planner
  plannerExpanded: boolean;
  onTogglePlannerExpanded: () => void;
  plannerWeights: PlannerWeights;
  onUpdatePlannerWeights: (w: PlannerWeights) => void;
  decayRadii: PlannerDecayRadii;
  onUpdateDecayRadii: (r: PlannerDecayRadii) => void;
  densityScales: PlannerDensityScales;
  onUpdateDensityScales: (d: PlannerDensityScales) => void;
  plannerConfig: PlannerConfig;
  onUpdatePlannerConfig: (c: PlannerConfig) => void;
  showSuitability: boolean;
  onToggleSuitability: () => void;
  isSuitabilityLoading: boolean;
  onRunOptimize: () => void;
  isOptimizing: boolean;
  plannerCoverage: PlannerCoverage | null;
  onApplyStations: () => void;
  hasGeneratedStations: boolean;
  onSeedLRT: () => void;
  onStep: () => void;
  isStepping: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function DesignerPanel({
  stations,
  selectedStationId,
  autoFocusName = false,
  onSelectStation,
  onUpdateStation,
  onCommitStation,
  onDeleteStation,
  onResetStations,
  onExitDesigner,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
  plannerExpanded,
  onTogglePlannerExpanded,
  plannerWeights,
  onUpdatePlannerWeights,
  decayRadii,
  onUpdateDecayRadii,
  densityScales,
  onUpdateDensityScales,
  plannerConfig,
  onUpdatePlannerConfig,
  showSuitability,
  onToggleSuitability,
  isSuitabilityLoading,
  onRunOptimize,
  isOptimizing,
  plannerCoverage,
  onApplyStations,
  hasGeneratedStations,
  onSeedLRT,
  onStep,
  isStepping,
}: DesignerPanelProps) {
  const selectedStation =
    stations.find((s) => s.id === selectedStationId) ?? null;
  const totalBikes = stations.reduce((sum, s) => sum + s.bikes, 0);
  const totalDocks = stations.reduce((sum, s) => sum + s.capacity, 0);

  // Auto-focus the name input when a new station is created
  const nameInputRef = useRef<HTMLInputElement>(null);
  const didAutoFocusRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      autoFocusName &&
      selectedStationId &&
      didAutoFocusRef.current !== selectedStationId
    ) {
      didAutoFocusRef.current = selectedStationId;
      // Small delay to let DOM mount
      requestAnimationFrame(() => {
        nameInputRef.current?.focus();
        nameInputRef.current?.select();
      });
    }
  }, [autoFocusName, selectedStationId]);

  return (
    <div className="absolute top-2.5 left-2.5 z-30 w-[380px] flex flex-col gap-2 max-h-[calc(100vh-20px)] overflow-hidden">
      {/* Header card */}
      <div className="bg-white rounded-lg shadow-[var(--shadow-lg)] overflow-hidden">
        {/* Title bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
          <button
            onClick={onExitDesigner}
            className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors"
            title="Back to directions"
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5f6368"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="text-[15px] font-medium text-[var(--color-fg)] leading-tight">
              Bike Share Designer
            </h1>
            <p className="text-[11px] text-[var(--color-secondary)] leading-tight mt-0.5">
              Right-click map to add · Click to select · Drag to move
            </p>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 px-4 py-2.5 bg-[#f8f9fa] text-[12px]">
          <span className="text-[var(--color-fg)] font-medium">
            {stations.length} stations
          </span>
          <span className="text-[var(--color-secondary)]">
            {totalBikes} bikes
          </span>
          <span className="text-[var(--color-secondary)]">
            {totalDocks} docks
          </span>
        </div>

        {/* Actions bar: undo/redo + reset */}
        <div className="flex items-center gap-1.5 px-3 py-2 border-t border-[var(--color-border)]">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            title="Undo (Ctrl+Z)"
            className="h-8 w-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-[var(--color-surface-hover)] disabled:hover:bg-transparent"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5f6368"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 10h13a4 4 0 010 8H7" />
              <path d="M7 6L3 10l4 4" />
            </svg>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            title="Redo (Ctrl+Y)"
            className="h-8 w-8 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-[var(--color-surface-hover)] disabled:hover:bg-transparent"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#5f6368"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 10H8a4 4 0 000 8h10" />
              <path d="M17 6l4 4-4 4" />
            </svg>
          </button>

          <div className="w-px h-5 bg-[var(--color-border)] mx-1" />

          <button
            onClick={() => {
              if (stations.length === 0) return;
              if (!window.confirm(`Clear all ${stations.length} stations?`)) return;
              onResetStations();
            }}
            disabled={stations.length === 0}
            className="h-8 px-3 text-[12px] font-medium rounded-full border border-[var(--color-border)] text-[#d32f2f] hover:bg-[#fde7e7] disabled:opacity-40 disabled:cursor-default transition-colors"
          >
            Clear All
          </button>

          {/* Keyboard hint */}
          <div className="ml-auto text-[10px] text-[var(--color-secondary)] opacity-60 select-none">
            {canUndo || canRedo ? "Ctrl+Z / Y" : ""}
          </div>
        </div>
      </div>

      {/* Auto-planner controls — flex-1 so it fills remaining vertical space */}
      <PlannerControls
        expanded={plannerExpanded}
        onToggleExpanded={onTogglePlannerExpanded}
        weights={plannerWeights}
        onUpdateWeights={onUpdatePlannerWeights}
        decayRadii={decayRadii}
        onUpdateDecayRadii={onUpdateDecayRadii}
        densityScales={densityScales}
        onUpdateDensityScales={onUpdateDensityScales}
        config={plannerConfig}
        onUpdateConfig={onUpdatePlannerConfig}
        showSuitability={showSuitability}
        onToggleSuitability={onToggleSuitability}
        isSuitabilityLoading={isSuitabilityLoading}
        onRunOptimize={onRunOptimize}
        isOptimizing={isOptimizing}
        optimizeError={null}
        coverage={plannerCoverage}
        onApplyStations={onApplyStations}
        hasGeneratedStations={hasGeneratedStations}
        onSeedLRT={onSeedLRT}
        stationCount={stations.length}
        onStep={onStep}
        isStepping={isStepping}
      />

      {/* Station editor — shown when a station is selected */}
      {selectedStation && (
        <div className="bg-white rounded-lg shadow-[var(--shadow-lg)] overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--color-border)]">
            <div className="min-w-0 flex-1">
              <p className="text-[11px] text-[var(--color-secondary)] uppercase tracking-wider">
                Editing station
              </p>
              <input
                ref={nameInputRef}
                type="text"
                value={selectedStation.name}
                onChange={(e) =>
                  onUpdateStation(selectedStation.id, { name: e.target.value })
                }
                onBlur={() => onCommitStation()}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.currentTarget.blur();
                  }
                  // Prevent Ctrl+Z from propagating to global undo while editing name
                  if (e.key === "z" && (e.ctrlKey || e.metaKey)) {
                    e.stopPropagation();
                  }
                }}
                className="text-[14px] font-medium text-[var(--color-fg)] mt-0.5 w-full bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-blue)] focus:outline-none transition-colors py-0.5 -mb-0.5"
                placeholder="Station name"
              />
            </div>
            <button
              onClick={() => onSelectStation(null)}
              className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors ml-2"
              title="Deselect (Esc)"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#5f6368"
                strokeWidth="2"
                strokeLinecap="round"
              >
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="px-4 py-3 space-y-4">
            {/* Capacity slider */}
            <SliderField
              label="Dock capacity"
              value={selectedStation.capacity}
              min={2}
              max={60}
              onChange={(val) => {
                onUpdateStation(selectedStation.id, {
                  capacity: val,
                  bikes: Math.min(selectedStation.bikes, val),
                });
              }}
              onCommit={onCommitStation}
            />

            {/* Bikes slider */}
            <SliderField
              label="Current bikes"
              value={selectedStation.bikes}
              min={0}
              max={selectedStation.capacity}
              onChange={(val) =>
                onUpdateStation(selectedStation.id, { bikes: val })
              }
              onCommit={onCommitStation}
              colorFn={(val, max) => {
                const pct = val / Math.max(max, 1);
                if (pct < 0.15 || pct > 0.85) return "#ea4335";
                if (pct < 0.3 || pct > 0.7) return "#fbbc04";
                return "#34a853";
              }}
            />

            {/* Fill indicator */}
            <div className="flex items-center gap-2 text-[12px] text-[var(--color-secondary)]">
              <div className="flex-1 h-2 rounded-full bg-[#e0e0e0] overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${(selectedStation.bikes / Math.max(selectedStation.capacity, 1)) * 100}%`,
                    backgroundColor: fillColor(selectedStation),
                  }}
                />
              </div>
              <span>
                {selectedStation.bikes}/{selectedStation.capacity}
              </span>
            </div>

            {/* Coordinates (read-only) */}
            <div className="text-[11px] text-[var(--color-secondary)] tabular-nums">
              {selectedStation.lat.toFixed(5)}, {selectedStation.lng.toFixed(5)}
            </div>

            {/* Delete */}
            <button
              onClick={() => {
                onDeleteStation(selectedStation.id);
                onSelectStation(null);
              }}
              className="w-full h-8 text-[12px] font-medium rounded-full border border-[#ea433580] text-[var(--color-red)] hover:bg-red-50 transition-colors"
            >
              Delete station
            </button>
          </div>
        </div>
      )}

      {/* Station list — takes remaining space */}
      <div className="bg-white rounded-lg shadow-[var(--shadow-lg)] overflow-hidden flex flex-col shrink min-h-[60px]">
        <div className="px-4 py-2 border-b border-[var(--color-border)] shrink-0">
          <p className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider">
            All stations
          </p>
        </div>
        <div className="overflow-y-auto flex-1 min-h-0">
          {stations.map((s) => (
            <button
              key={s.id}
              onClick={() => onSelectStation(s.id)}
              className={`w-full text-left px-4 py-2 flex items-center gap-3 border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
                s.id === selectedStationId
                  ? "bg-[#e8f0fe]"
                  : "hover:bg-[var(--color-surface-hover)]"
              }`}
            >
              <div
                className="shrink-0 w-3 h-3 rounded-full border-2 border-white"
                style={{
                  backgroundColor: fillColor(s),
                  boxShadow: "0 0 0 1px rgba(0,0,0,0.1)",
                }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--color-fg)] truncate">
                  {s.name}
                </p>
              </div>
              <span className="text-[11px] text-[var(--color-secondary)] tabular-nums shrink-0">
                {s.bikes}/{s.capacity}
              </span>
            </button>
          ))}
          {stations.length === 0 && (
            <div className="px-4 py-8 text-center text-[13px] text-[var(--color-secondary)]">
              No stations yet. Right-click the map to add one.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fillColor(s: BikeStation): string {
  const pct = s.bikes / Math.max(s.capacity, 1);
  if (pct < 0.15 || pct > 0.85) return "#ea4335"; // red – danger
  if (pct < 0.3 || pct > 0.7) return "#fbbc04"; // yellow – warning
  return "#34a853"; // green – balanced
}

// ---------------------------------------------------------------------------
// SliderField
// ---------------------------------------------------------------------------

function SliderField({
  label,
  value,
  min,
  max,
  onChange,
  onCommit,
  colorFn,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (val: number) => void;
  /** Called when the user releases the slider — commits to undo history. */
  onCommit?: () => void;
  colorFn?: (val: number, max: number) => string;
}) {
  const color = colorFn ? colorFn(value, max) : "var(--color-blue)";

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-[var(--color-secondary)]">
          {label}
        </span>
        <span className="text-[13px] font-medium text-[var(--color-fg)] tabular-nums">
          {value}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={() => onCommit?.()}
        onKeyUp={(e) => {
          if (e.key === "ArrowLeft" || e.key === "ArrowRight") onCommit?.();
        }}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, #e0e0e0 ${((value - min) / (max - min)) * 100}%)`,
          accentColor: color,
        }}
      />
    </div>
  );
}
