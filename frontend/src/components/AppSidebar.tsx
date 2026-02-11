"use client";

import { useState } from "react";
import type {
  GeocodedPlace,
  BikeStation,
  RouteOption,
  PlannerWeights,
  PlannerDecayRadii,
  PlannerDensityScales,
  PlannerConfig,
  PlannerCoverage,
  SavedNetwork,
  BuildLogEntry,
  AppMode,
} from "@/lib/types";
import SearchPanel from "@/components/SearchPanel";
import PlannerControls from "@/components/PlannerControls";
import StationList from "@/components/StationList";
import StationEditor from "@/components/StationEditor";
import SavedNetworksList from "@/components/SavedNetworksList";
import BuildHistory from "@/components/BuildHistory";
import { DocsNav } from "@/components/DocsView";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type DesignerTab = "planner" | "stations" | "history";

interface AppSidebarProps {
  mode: AppMode;

  // ── Routing props ──
  origin: GeocodedPlace | null;
  destination: GeocodedPlace | null;
  onSetOrigin: (place: GeocodedPlace | null) => void;
  onSetDestination: (place: GeocodedPlace | null) => void;
  routes: RouteOption[];
  routeNotices: string[];
  selectedRouteIndex: number | null;
  onSelectRoute: (index: number) => void;
  isLoadingRoutes: boolean;
  departureTime: string | null;
  onSetDepartureTime: (time: string | null) => void;
  onGetDirections: () => void;
  onFlyToPlace: (place: GeocodedPlace) => void;

  // ── Designer props ──
  stations: BikeStation[];
  selectedStationId: string | null;
  autoFocusName: boolean;
  onSelectStation: (id: string | null) => void;
  onUpdateStation: (id: string, updates: Partial<BikeStation>) => void;
  onCommitStation: () => void;
  onDeleteStation: (id: string) => void;
  onResetStations: () => void;
  onUndo: () => void;
  onRedo: () => void;
  canUndo: boolean;
  canRedo: boolean;

  // ── Planner props ──
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
  optimizeError: string | null;
  plannerCoverage: PlannerCoverage | null;
  onApplyStations: () => void;
  hasGeneratedStations: boolean;
  onSeedLRT: () => void;
  onStep: () => void;
  isStepping: boolean;

  // ── Active Network ──
  activeNetworkId: string | null;
  activeNetworkName: string;
  onRenameNetwork: (name: string) => void;
  onSaveNetwork: () => void;
  onSaveAsNetwork: () => void;
  onNewNetwork: () => void;
  onLoadNetwork: (network: SavedNetwork) => void;

  // ── Confirm / Clear ──
  onClearAll: () => void;

  // ── Build History ──
  buildLog: BuildLogEntry[];
  onPreviewSnapshot: (stations: BikeStation[] | null) => void;

  // ── Docs mode ──
  docsActiveId: string;
  onDocsNavigate: (id: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppSidebar(props: AppSidebarProps) {
  const [designerTab, setDesignerTab] = useState<DesignerTab>("planner");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  const {
    mode,
    stations,
    selectedStationId,
    autoFocusName,
    onSelectStation,
    onUpdateStation,
    onCommitStation,
    onDeleteStation,
    onClearAll,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
  } = props;

  const selectedStation = stations.find((s) => s.id === selectedStationId) ?? null;
  const totalBikes = stations.reduce((sum, s) => sum + s.bikes, 0);
  const totalDocks = stations.reduce((sum, s) => sum + s.capacity, 0);

  return (
    <div className="h-full bg-white flex flex-col">
      {/* ── Active Network bar (persistent across all modes except docs) ── */}
      {mode !== "docs" && (
        <div className="px-4 pt-3 pb-2 border-b border-[var(--color-border)] bg-[#f8f9fa] shrink-0">
          {/* Network name (click to edit) */}
          <div className="flex items-center gap-2 mb-1.5">
            {/* Status dot */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: props.activeNetworkId ? "#34a853" : "#9aa0a6" }}
              title={props.activeNetworkId ? "Saved" : "Unsaved"}
            />
            {isEditingName ? (
              <form
                className="flex-1 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editNameValue.trim()) {
                    props.onRenameNetwork(editNameValue.trim());
                  }
                  setIsEditingName(false);
                }}
              >
                <input
                  autoFocus
                  value={editNameValue}
                  onChange={(e) => setEditNameValue(e.target.value)}
                  className="flex-1 text-[13px] font-medium px-1.5 py-0.5 border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-blue)] bg-white"
                  onKeyDown={(e) => e.key === "Escape" && setIsEditingName(false)}
                  onBlur={() => {
                    if (editNameValue.trim()) props.onRenameNetwork(editNameValue.trim());
                    setIsEditingName(false);
                  }}
                />
              </form>
            ) : (
              <button
                onClick={() => { setEditNameValue(props.activeNetworkName); setIsEditingName(true); }}
                className="flex-1 text-left text-[13px] font-medium text-[var(--color-fg)] hover:text-[var(--color-blue)] transition-colors truncate"
                title="Click to rename"
              >
                {props.activeNetworkName}
              </button>
            )}
          </div>
          {/* Network actions */}
          <div className="flex items-center gap-1">
            <button
              onClick={props.onNewNetwork}
              className="h-6 px-2 text-[10px] font-medium rounded text-[var(--color-secondary)] hover:text-[var(--color-fg)] hover:bg-[#e8eaed] transition-colors"
              title="Start a new empty network"
            >
              New
            </button>
            <button
              onClick={props.onSaveNetwork}
              className="h-6 px-2 text-[10px] font-medium rounded text-[var(--color-blue)] hover:bg-[#e8f0fe] transition-colors"
            >
              {props.activeNetworkId ? "Save" : "Save As\u2026"}
            </button>
            {props.activeNetworkId && (
              <button
                onClick={props.onSaveAsNetwork}
                className="h-6 px-2 text-[10px] font-medium rounded text-[var(--color-secondary)] hover:text-[var(--color-fg)] hover:bg-[#e8eaed] transition-colors"
              >
                Save As\u2026
              </button>
            )}
            <div className="flex-1" />
            <span className="text-[10px] text-[var(--color-secondary)] tabular-nums">
              {stations.length} stations
            </span>
          </div>
        </div>
      )}

      {/* ── Docs mode ── */}
      {mode === "docs" ? (
        <DocsNav activeId={props.docsActiveId} onNavigate={props.onDocsNavigate} />
      ) : mode === "saved" ? (
        /* ── Saved networks mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarHeader
            title="Saved Networks"
            subtitle="Load a previously saved network draft"
          />
          <SavedNetworksList onLoad={props.onLoadNetwork} activeNetworkId={props.activeNetworkId} />
        </div>
      ) : mode === "routing" ? (
        /* ── Routing mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarHeader
            title="Trip Planner"
            subtitle="Plan trips with bike share, transit & more"
          />
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            <SearchPanel
              origin={props.origin}
              destination={props.destination}
              onSetOrigin={props.onSetOrigin}
              onSetDestination={props.onSetDestination}
              routes={props.routes}
              routeNotices={props.routeNotices}
              selectedRouteIndex={props.selectedRouteIndex}
              onSelectRoute={props.onSelectRoute}
              isLoading={props.isLoadingRoutes}
              departureTime={props.departureTime}
              onSetDepartureTime={props.onSetDepartureTime}
              onGetDirections={props.onGetDirections}
              onFlyToPlace={props.onFlyToPlace}
            />
          </div>
        </div>
      ) : (
        /* ── Designer mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header + stats */}
          <div className="px-5 pt-3 pb-2 border-b border-[var(--color-border)]">
            <p className="text-[12px] text-[var(--color-secondary)]">
              Right-click map to add stations
            </p>
            {/* Stats row */}
            <div className="flex items-center gap-4 mt-1.5 text-[12px]">
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
            {/* Actions: undo / redo / clear */}
            <div className="flex items-center gap-1.5 mt-2 -mx-1">
              <IconBtn onClick={onUndo} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <path d="M3 10h13a4 4 0 010 8H7" />
                <path d="M7 6L3 10l4 4" />
              </IconBtn>
              <IconBtn onClick={onRedo} disabled={!canRedo} title="Redo (Ctrl+Y)">
                <path d="M21 10H8a4 4 0 000 8h10" />
                <path d="M17 6l4 4-4 4" />
              </IconBtn>
              <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
              <button
                onClick={onClearAll}
                disabled={stations.length === 0}
                className="h-7 px-2.5 text-[11px] font-medium rounded-full text-[#d32f2f] hover:bg-[#fde7e7] disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>

          {/* Tab bar */}
          <div className="flex border-b border-[var(--color-border)] shrink-0">
            <TabButton
              label="Network Planner"
              active={designerTab === "planner"}
              onClick={() => setDesignerTab("planner")}
            />
            <TabButton
              label={`Stations${stations.length > 0 ? ` (${stations.length})` : ""}`}
              active={designerTab === "stations"}
              onClick={() => setDesignerTab("stations")}
            />
            <TabButton
              label={`History${props.buildLog.length > 0 ? ` (${props.buildLog.length})` : ""}`}
              active={designerTab === "history"}
              onClick={() => setDesignerTab("history")}
            />
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {designerTab === "planner" ? (
              <PlannerControls
                expanded={true}
                onToggleExpanded={() => {}}
                weights={props.plannerWeights}
                onUpdateWeights={props.onUpdatePlannerWeights}
                decayRadii={props.decayRadii}
                onUpdateDecayRadii={props.onUpdateDecayRadii}
                densityScales={props.densityScales}
                onUpdateDensityScales={props.onUpdateDensityScales}
                config={props.plannerConfig}
                onUpdateConfig={props.onUpdatePlannerConfig}
                showSuitability={props.showSuitability}
                onToggleSuitability={props.onToggleSuitability}
                isSuitabilityLoading={props.isSuitabilityLoading}
                onRunOptimize={props.onRunOptimize}
                isOptimizing={props.isOptimizing}
                optimizeError={props.optimizeError}
                coverage={props.plannerCoverage}
                onApplyStations={props.onApplyStations}
                hasGeneratedStations={props.hasGeneratedStations}
                onSeedLRT={props.onSeedLRT}
                stationCount={stations.length}
                onStep={props.onStep}
                isStepping={props.isStepping}
              />
            ) : designerTab === "history" ? (
              <BuildHistory
                buildLog={props.buildLog}
                stations={stations}
                onPreviewSnapshot={props.onPreviewSnapshot}
              />
            ) : (
              <div className="flex flex-col h-full min-h-0">
                {selectedStation && (
                  <StationEditor
                    station={selectedStation}
                    autoFocusName={autoFocusName}
                    onUpdate={(updates) => onUpdateStation(selectedStation.id, updates)}
                    onCommit={onCommitStation}
                    onDelete={() => {
                      onDeleteStation(selectedStation.id);
                      onSelectStation(null);
                    }}
                    onDeselect={() => onSelectStation(null)}
                  />
                )}
                <StationList
                  stations={stations}
                  selectedStationId={selectedStationId}
                  onSelectStation={onSelectStation}
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** Unified sidebar header used by routing, saved, and docs modes. */
function SidebarHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
      <h1 className="text-[16px] font-medium text-[var(--color-fg)]">{title}</h1>
      <p className="text-[12px] text-[var(--color-secondary)] mt-0.5">{subtitle}</p>
    </div>
  );
}

function TabButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-[13px] font-medium transition-colors relative ${
        active
          ? "text-[var(--color-blue)]"
          : "text-[var(--color-secondary)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {label}
      {active && (
        <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-[var(--color-blue)] rounded-t-full" />
      )}
    </button>
  );
}

function IconBtn({
  onClick,
  disabled,
  title,
  children,
}: {
  onClick: () => void;
  disabled: boolean;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-[var(--color-surface-hover)] disabled:hover:bg-transparent"
    >
      <svg
        width="15"
        height="15"
        viewBox="0 0 24 24"
        fill="none"
        stroke="#5f6368"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {children}
      </svg>
    </button>
  );
}
