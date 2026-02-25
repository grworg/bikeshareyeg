"use client";

import { useCallback, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAppStore } from "@/lib/appStore";
import { useNetworkStore } from "@/lib/networkStore";
import type { AppMode, GeocodedPlace, SavedNetwork } from "@/lib/types";
import SearchPanel from "@/components/SearchPanel";
import PlannerControls from "@/components/PlannerControls";
import StationList from "@/components/StationList";
import StationEditor from "@/components/StationEditor";
import SavedNetworksList from "@/components/SavedNetworksList";
import BuildHistory from "@/components/BuildHistory";
import {
  shareNetwork as apiShareNetwork,
} from "@/lib/api";
import {
  generateOwnerSecret,
  hashOwnerSecret,
  storeOwnerSecret,
  saveNetwork as persistNetwork,
} from "@/lib/savedNetworks";

function modeFromPathname(pathname: string): AppMode {
  if (pathname.startsWith("/designer")) return "designer";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/docs")) return "docs";
  return "routing";
}

export type DesignerTab = "planner" | "stations" | "history";

export default function AppSidebar() {
  const pathname = usePathname();
  const mode = modeFromPathname(pathname);
  const router = useRouter();

  // ---- Zustand selectors ----
  const origin = useAppStore((s) => s.origin);
  const destination = useAppStore((s) => s.destination);
  const routes = useAppStore((s) => s.routes);
  const routeNotices = useAppStore((s) => s.routeNotices);
  const selectedRouteIndex = useAppStore((s) => s.selectedRouteIndex);
  const isLoadingRoutes = useAppStore((s) => s.isLoadingRoutes);
  const departureTime = useAppStore((s) => s.departureTime);
  const selectedStationId = useAppStore((s) => s.selectedStationId);
  const autoFocusName = useAppStore((s) => s.autoFocusName);
  const overlayData = useAppStore((s) => s.overlayData);
  const activeOverlays = useAppStore((s) => s.activeOverlays);
  const previewStations = useAppStore((s) => s.previewStations);

  const stations = useNetworkStore((s) => s.stations);
  const buildLog = useNetworkStore((s) => s.buildLog);
  const activeNetworkId = useNetworkStore((s) => s.activeNetworkId);
  const activeNetworkName = useNetworkStore((s) => s.activeNetworkName);
  const plannerConfig = useNetworkStore((s) => s.plannerConfig);
  const plannerWeights = useNetworkStore((s) => s.plannerWeights);
  const decayRadii = useNetworkStore((s) => s.decayRadii);
  const densityScales = useNetworkStore((s) => s.densityScales);
  const showSuitability = useNetworkStore((s) => s.showSuitability);
  const isSuitabilityLoading = useNetworkStore((s) => s.isSuitabilityLoading);
  const isOptimizing = useNetworkStore((s) => s.isOptimizing);
  const isStepping = useNetworkStore((s) => s.isStepping);
  const optimizeError = useNetworkStore((s) => s.optimizeError);
  const plannerCoverage = useNetworkStore((s) => s.plannerCoverage);
  const generatedStations = useNetworkStore((s) => s.generatedStations);
  const lastAutoSaveAt = useNetworkStore((s) => s.lastAutoSaveAt);

  const [designerTab, setDesignerTab] = useState<DesignerTab>("planner");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  // Sharing state
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const selectedStation = stations.find((s) => s.id === selectedStationId) ?? null;
  const totalBikes = stations.reduce((sum, s) => sum + s.bikes, 0);
  const totalDocks = stations.reduce((sum, s) => sum + s.capacity, 0);

  // ---- Handlers (use getState() to avoid stale closures) ----

  const handleFlyToPlace = useCallback((place: GeocodedPlace) => {
    useAppStore.getState().setFlyTo({ latitude: place.lat, longitude: place.lng, zoom: 14, _ts: Date.now() });
  }, []);

  const handleSaveNetwork = useCallback(() => {
    const ns = useNetworkStore.getState();
    if (ns.activeNetworkId) {
      ns.saveCurrentNetwork();
      useAppStore.getState().setModal({ type: "alert", title: "Saved", message: `"${ns.activeNetworkName}" has been saved.` });
    } else {
      const defaultName = `Network \u2013 ${ns.stations.length} stations`;
      useAppStore.getState().setModal({
        type: "prompt",
        title: "Save Network",
        message: "Give your network a name.",
        defaultValue: defaultName,
        placeholder: "Network name\u2026",
        onSubmit: (name: string) => {
          useNetworkStore.getState().saveAsNetwork(name.trim() || defaultName);
        },
      });
    }
  }, []);

  const handleSaveAsNetwork = useCallback(() => {
    const ns = useNetworkStore.getState();
    const defaultName = ns.activeNetworkName
      ? `${ns.activeNetworkName} (copy)`
      : `Network \u2013 ${ns.stations.length} stations`;
    useAppStore.getState().setModal({
      type: "prompt",
      title: "Save As New Network",
      message: "Give this copy a new name.",
      defaultValue: defaultName,
      placeholder: "Network name\u2026",
      onSubmit: (name: string) => {
        useNetworkStore.getState().saveAsNetwork(name.trim() || defaultName);
      },
    });
  }, []);

  const handleNewNetwork = useCallback(() => {
    const doNew = () => {
      useNetworkStore.getState().newNetwork();
      router.push("/designer");
    };
    if (useNetworkStore.getState().stations.length > 0) {
      useAppStore.getState().setModal({
        type: "confirm",
        title: "New Network",
        message: "Start a new empty network? Any unsaved changes will be lost.",
        onConfirm: doNew,
      });
    } else {
      doNew();
    }
  }, [router]);

  const handleClearAll = useCallback(() => {
    const ns = useNetworkStore.getState();
    if (ns.stations.length === 0) return;
    useAppStore.getState().setModal({
      type: "confirm",
      title: "Clear All Stations",
      message: `This will remove all ${ns.stations.length} stations from your network. This action can be undone.`,
      onConfirm: () => {
        useNetworkStore.getState().resetStations();
        useAppStore.getState().setSelectedStationId(null);
      },
    });
  }, []);

  const handleLoadNetwork = useCallback((network: SavedNetwork) => {
    useNetworkStore.getState().loadNetwork(network);
    router.push(`/designer/${network.id}`);
  }, [router]);

  const handleSeedLRT = useCallback(() => {
    const as = useAppStore.getState();
    const lrtData = as.overlayData.lrt;
    if (!lrtData) {
      if (!as.activeOverlays.has("lrt")) {
        as.setActiveOverlays((prev) => new Set([...prev, "lrt"]));
      }
      as.setModal({ type: "alert", title: "LRT Data Loading", message: "LRT data is still loading \u2014 try again in a moment." });
      return;
    }
    const lrtPoints = lrtData.features.filter((f) => f.geometry.type === "Point");
    if (lrtPoints.length === 0) {
      as.setModal({ type: "alert", title: "No LRT Stations", message: "No LRT station points found in overlay data." });
      return;
    }
    const added = useNetworkStore.getState().seedLRT(as.overlayData);
    if (added === 0) {
      as.setModal({ type: "alert", title: "Already Seeded", message: "All LRT stations already have docks nearby." });
    }
  }, []);

  // ---- Share handler ----
  const handleShare = useCallback(async () => {
    const ns = useNetworkStore.getState();
    if (!ns.activeNetworkId) return;
    setIsSharing(true);
    setShareError(null);
    try {
      const draft = ns.buildDraft(ns.activeNetworkId, ns.activeNetworkName);
      const secret = generateOwnerSecret();
      const hash = await hashOwnerSecret(secret);
      const result = await apiShareNetwork(hash, draft);
      storeOwnerSecret(result.id, secret);
      const updated: SavedNetwork = { ...draft, shareId: result.id, sharedAt: new Date().toISOString() };
      persistNetwork(updated);
      const url = `${window.location.origin}/network/${result.id}`;
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
      } catch {
        prompt("Copy this link:", url);
      }
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setIsSharing(false);
    }
  }, []);

  const handleCopyShareLink = useCallback(async () => {
    const ns = useNetworkStore.getState();
    const draft = ns.buildDraft(ns.activeNetworkId ?? "", ns.activeNetworkName);
    if (!draft.shareId) return;
    const url = `${window.location.origin}/network/${draft.shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link:", url);
    }
  }, []);

  const currentDraft = activeNetworkId
    ? useNetworkStore.getState().buildDraft(activeNetworkId, activeNetworkName)
    : null;
  const isShared = !!currentDraft?.shareId;

  // canUndo / canRedo are methods, subscribe to _past/_future length
  const pastLen = useNetworkStore((s) => s._past.length);
  const futureLen = useNetworkStore((s) => s._future.length);
  const canUndo = pastLen > 0;
  const canRedo = futureLen > 0;

  return (
    <div className="h-full bg-white flex flex-col">
      {/* ── Active Network bar ── */}
      {mode !== "docs" && mode !== "saved" && (
        <div className="px-4 pt-3 pb-2 border-b border-[var(--color-border)] bg-[#f8f9fa] shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: activeNetworkId ? "#34a853" : "#9aa0a6" }}
              title={lastAutoSaveAt ? `Auto-saved ${new Date(lastAutoSaveAt).toLocaleTimeString()}` : activeNetworkId ? "Saved" : "Unsaved"}
            />
            {isEditingName ? (
              <form
                className="flex-1 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editNameValue.trim()) useNetworkStore.getState().renameNetwork(editNameValue.trim());
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
                    if (editNameValue.trim()) useNetworkStore.getState().renameNetwork(editNameValue.trim());
                    setIsEditingName(false);
                  }}
                />
              </form>
            ) : (
              <button
                onClick={() => { setEditNameValue(activeNetworkName); setIsEditingName(true); }}
                className="flex-1 text-left text-[13px] font-medium text-[var(--color-fg)] hover:text-[var(--color-blue)] transition-colors truncate"
                title="Click to rename"
              >
                {activeNetworkName}
              </button>
            )}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={handleNewNetwork}
              className="h-6 px-2 text-[10px] font-medium rounded text-[var(--color-secondary)] hover:text-[var(--color-fg)] hover:bg-[#e8eaed] transition-colors"
              title="Start a new empty network"
            >
              New
            </button>
            <button
              onClick={handleSaveNetwork}
              className="h-6 px-2 text-[10px] font-medium rounded text-[var(--color-blue)] hover:bg-[#e8f0fe] transition-colors"
            >
              {activeNetworkId ? "Save" : "Save As\u2026"}
            </button>
            {activeNetworkId && (
              <button
                onClick={handleSaveAsNetwork}
                className="h-6 px-2 text-[10px] font-medium rounded text-[var(--color-secondary)] hover:text-[var(--color-fg)] hover:bg-[#e8eaed] transition-colors"
              >
                Save As\u2026
              </button>
            )}
            {activeNetworkId && (
              isShared ? (
                <button
                  onClick={handleCopyShareLink}
                  className={`h-6 px-2 text-[10px] font-medium rounded transition-colors ${
                    copied ? "text-[#34a853] bg-[#e6f4ea]" : "text-[#1a73e8] hover:bg-[#e8f0fe]"
                  }`}
                >
                  {copied ? "Link copied!" : "Copy link"}
                </button>
              ) : (
                <button
                  onClick={handleShare}
                  disabled={isSharing}
                  className="h-6 px-2 text-[10px] font-medium rounded text-[#1a73e8] hover:bg-[#e8f0fe] transition-colors disabled:opacity-50"
                >
                  {isSharing ? "Sharing\u2026" : copied ? "Link copied!" : "Share"}
                </button>
              )
            )}
            <div className="flex-1" />
            {lastAutoSaveAt && (
              <span className="text-[9px] text-[var(--color-secondary)] tabular-nums mr-1">
                Auto-saved
              </span>
            )}
            <span className="text-[10px] text-[var(--color-secondary)] tabular-nums">
              {stations.length} stations
            </span>
          </div>
          {shareError && <p className="text-[10px] text-red-600 mt-1">{shareError}</p>}
        </div>
      )}

      {/* ── Saved networks mode ── */}
      {mode === "saved" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarHeader title="Saved Networks" subtitle="Load a previously saved network draft" />
          <SavedNetworksList onLoad={handleLoadNetwork} activeNetworkId={activeNetworkId} />
        </div>
      ) : mode === "routing" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarHeader title="Trip Planner" subtitle="Plan trips with bike share, transit & more" />
          <div className="flex-1 min-h-0 flex flex-col overflow-y-auto">
            <SearchPanel
              origin={origin}
              destination={destination}
              onSetOrigin={useAppStore.getState().setOrigin}
              onSetDestination={useAppStore.getState().setDestination}
              routes={routes}
              routeNotices={routeNotices}
              selectedRouteIndex={selectedRouteIndex}
              onSelectRoute={useAppStore.getState().setSelectedRouteIndex}
              isLoading={isLoadingRoutes}
              departureTime={departureTime}
              onSetDepartureTime={useAppStore.getState().setDepartureTime}
              onGetDirections={useAppStore.getState().getDirections}
              onFlyToPlace={handleFlyToPlace}
            />
          </div>
        </div>
      ) : mode === "designer" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <div className="px-5 pt-3 pb-2 border-b border-[var(--color-border)]">
            <p className="text-[12px] text-[var(--color-secondary)]">
              Right-click map to add stations
            </p>
            <div className="flex items-center gap-4 mt-1.5 text-[12px]">
              <span className="text-[var(--color-fg)] font-medium">{stations.length} stations</span>
              <span className="text-[var(--color-secondary)]">{totalBikes} bikes</span>
              <span className="text-[var(--color-secondary)]">{totalDocks} docks</span>
            </div>
            <div className="flex items-center gap-1.5 mt-2 -mx-1">
              <IconBtn onClick={() => useNetworkStore.getState().undo()} disabled={!canUndo} title="Undo (Ctrl+Z)">
                <path d="M3 10h13a4 4 0 010 8H7" />
                <path d="M7 6L3 10l4 4" />
              </IconBtn>
              <IconBtn onClick={() => useNetworkStore.getState().redo()} disabled={!canRedo} title="Redo (Ctrl+Y)">
                <path d="M21 10H8a4 4 0 000 8h10" />
                <path d="M17 6l4 4-4 4" />
              </IconBtn>
              <div className="w-px h-4 bg-[var(--color-border)] mx-1" />
              <button
                onClick={handleClearAll}
                disabled={stations.length === 0}
                className="h-7 px-2.5 text-[11px] font-medium rounded-full text-[#d32f2f] hover:bg-[#fde7e7] disabled:opacity-30 disabled:cursor-default transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
          <div className="flex border-b border-[var(--color-border)] shrink-0">
            <TabButton label="Network Planner" active={designerTab === "planner"} onClick={() => setDesignerTab("planner")} />
            <TabButton label={`Stations${stations.length > 0 ? ` (${stations.length})` : ""}`} active={designerTab === "stations"} onClick={() => setDesignerTab("stations")} />
            <TabButton label={`History${buildLog.length > 0 ? ` (${buildLog.length})` : ""}`} active={designerTab === "history"} onClick={() => setDesignerTab("history")} />
          </div>
          <div className="flex-1 overflow-y-auto min-h-0">
            {designerTab === "planner" ? (
              <PlannerControls
                expanded={true}
                onToggleExpanded={() => {}}
                weights={plannerWeights}
                onUpdateWeights={useNetworkStore.getState().setPlannerWeights}
                decayRadii={decayRadii}
                onUpdateDecayRadii={useNetworkStore.getState().setDecayRadii}
                densityScales={densityScales}
                onUpdateDensityScales={useNetworkStore.getState().setDensityScales}
                config={plannerConfig}
                onUpdateConfig={useNetworkStore.getState().setPlannerConfig}
                showSuitability={showSuitability}
                onToggleSuitability={useNetworkStore.getState().toggleSuitability}
                isSuitabilityLoading={isSuitabilityLoading}
                onRunOptimize={useNetworkStore.getState().runOptimize}
                isOptimizing={isOptimizing}
                optimizeError={optimizeError}
                coverage={plannerCoverage}
                onApplyStations={useNetworkStore.getState().applyStations}
                hasGeneratedStations={!!generatedStations}
                onSeedLRT={handleSeedLRT}
                stationCount={stations.length}
                onStep={useNetworkStore.getState().step}
                isStepping={isStepping}
              />
            ) : designerTab === "history" ? (
              <BuildHistory
                buildLog={buildLog}
                stations={stations}
                onPreviewSnapshot={useAppStore.getState().setPreviewStations}
                onRevertToSnapshot={useNetworkStore.getState().revertToSnapshot}
              />
            ) : (
              <div className="flex flex-col h-full min-h-0">
                {selectedStation && (
                  <StationEditor
                    station={selectedStation}
                    autoFocusName={autoFocusName}
                    onUpdate={(updates) => useNetworkStore.getState().updateStation(selectedStation.id, updates)}
                    onCommit={useNetworkStore.getState().commitStation}
                    onDelete={() => {
                      useNetworkStore.getState().deleteStation(selectedStation.id);
                      useAppStore.getState().setSelectedStationId(null);
                    }}
                    onDeselect={() => useAppStore.getState().setSelectedStationId(null)}
                  />
                )}
                <StationList
                  stations={stations}
                  selectedStationId={selectedStationId}
                  onSelectStation={useAppStore.getState().setSelectedStationId}
                />
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function SidebarHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
      <h1 className="text-[16px] font-medium text-[var(--color-fg)]">{title}</h1>
      <p className="text-[12px] text-[var(--color-secondary)] mt-0.5">{subtitle}</p>
    </div>
  );
}

function TabButton({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 py-2.5 text-[13px] font-medium transition-colors relative ${
        active ? "text-[var(--color-blue)]" : "text-[var(--color-secondary)] hover:text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {label}
      {active && <div className="absolute bottom-0 left-4 right-4 h-[3px] bg-[var(--color-blue)] rounded-t-full" />}
    </button>
  );
}

function IconBtn({ onClick, disabled, title, children }: { onClick: () => void; disabled: boolean; title: string; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="h-7 w-7 rounded-full flex items-center justify-center transition-colors disabled:opacity-30 hover:bg-[var(--color-surface-hover)] disabled:hover:bg-transparent"
    >
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
