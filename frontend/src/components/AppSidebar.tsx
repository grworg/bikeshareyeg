"use client";

import { useState } from "react";
import type {
  GeocodedPlace,
  BikeStation,
  RouteOption,
  PlannerWeights,
  PlannerDecayRadii,
  PlannerConfig,
  PlannerCoverage,
  SavedNetwork,
} from "@/lib/types";
import SearchPanel from "@/components/SearchPanel";
import PlannerControls from "@/components/PlannerControls";
import StationList from "@/components/StationList";
import StationEditor from "@/components/StationEditor";
import SavedNetworksList from "@/components/SavedNetworksList";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type DesignerTab = "planner" | "stations";

interface AppSidebarProps {
  mode: "routing" | "designer" | "saved";

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

  // ── Save / Load ──
  onSaveNetwork: () => void;
  onLoadNetwork: (network: SavedNetwork) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppSidebar(props: AppSidebarProps) {
  const [designerTab, setDesignerTab] = useState<DesignerTab>("planner");

  const {
    mode,
    stations,
    selectedStationId,
    autoFocusName,
    onSelectStation,
    onUpdateStation,
    onCommitStation,
    onDeleteStation,
    onResetStations,
    onUndo,
    onRedo,
    canUndo,
    canRedo,
  } = props;

  const selectedStation = stations.find((s) => s.id === selectedStationId) ?? null;
  const totalBikes = stations.reduce((sum, s) => sum + s.bikes, 0);
  const totalDocks = stations.reduce((sum, s) => sum + s.capacity, 0);

  return (
    <div className="w-[400px] h-full bg-white flex flex-col shrink-0 z-30 shadow-[2px_0_8px_rgba(0,0,0,0.08)]">
      {mode === "saved" ? (
        /* ── Saved networks mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
            <h1 className="text-[16px] font-medium text-[var(--color-fg)]">
              Saved Networks
            </h1>
            <p className="text-[12px] text-[var(--color-secondary)] mt-0.5">
              Load a previously saved network draft
            </p>
          </div>
          <SavedNetworksList onLoad={props.onLoadNetwork} />
        </div>
      ) : mode === "routing" ? (
        /* ── Routing mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header */}
          <div className="px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
            <h1 className="text-[16px] font-medium text-[var(--color-fg)]">
              BikeShareYEG
            </h1>
            <p className="text-[12px] text-[var(--color-secondary)] mt-0.5">
              Plan trips with bike share, transit &amp; more
            </p>
          </div>
          {/* Search panel fills remaining space — no overflow clip on parent so autocomplete can escape */}
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
          <div className="px-5 pt-4 pb-2 border-b border-[var(--color-border)]">
            <h1 className="text-[16px] font-medium text-[var(--color-fg)]">
              Network Designer
            </h1>
            <p className="text-[12px] text-[var(--color-secondary)] mt-0.5">
              Right-click map to add stations
            </p>
            {/* Stats row */}
            <div className="flex items-center gap-4 mt-2.5 text-[12px]">
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
                onClick={() => {
                  if (stations.length === 0) return;
                  if (!window.confirm(`Clear all ${stations.length} stations?`)) return;
                  onResetStations();
                }}
                disabled={stations.length === 0}
                className="h-7 px-2.5 text-[11px] font-medium rounded-full text-[#d32f2f] hover:bg-[#fde7e7] disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                Clear All
              </button>
              <div className="flex-1" />
              <button
                onClick={props.onSaveNetwork}
                className="h-7 px-3 text-[11px] font-medium rounded-full text-[var(--color-blue)] bg-[#e8f0fe] hover:bg-[#d2e3fc] transition-colors flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                  <polyline points="7 3 7 8 15 8" />
                </svg>
                Save Draft
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
            ) : (
              <div className="flex flex-col h-full min-h-0">
                {/* Station editor (if selected) */}
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
                {/* Station list */}
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
