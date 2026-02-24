"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { useNetwork } from "@/lib/NetworkContext";
import type { GeocodedPlace, SavedNetwork } from "@/lib/types";
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

// ---------------------------------------------------------------------------
// Sub-tab for designer mode
// ---------------------------------------------------------------------------

export type DesignerTab = "planner" | "stations" | "history";

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function AppSidebar() {
  const app = useApp();
  const net = useNetwork();
  const router = useRouter();
  const { mode } = app;

  const [designerTab, setDesignerTab] = useState<DesignerTab>("planner");
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");

  // Sharing state
  const [isSharing, setIsSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { stations, buildLog } = net;
  const selectedStation = stations.find((s) => s.id === app.selectedStationId) ?? null;
  const totalBikes = stations.reduce((sum, s) => sum + s.bikes, 0);
  const totalDocks = stations.reduce((sum, s) => sum + s.capacity, 0);

  // ---- Handlers ----

  const handleFlyToPlace = useCallback((place: GeocodedPlace) => {
    app.setFlyTo({ latitude: place.lat, longitude: place.lng, zoom: 14, _ts: Date.now() });
  }, [app]);

  const handleSaveNetwork = useCallback(() => {
    if (net.activeNetworkId) {
      net.saveCurrentNetwork();
      app.setModal({ type: "alert", title: "Saved", message: `"${net.activeNetworkName}" has been saved.` });
    } else {
      const defaultName = `Network \u2013 ${stations.length} stations`;
      app.setModal({
        type: "prompt",
        title: "Save Network",
        message: "Give your network a name.",
        defaultValue: defaultName,
        placeholder: "Network name\u2026",
        onSubmit: (name: string) => {
          const finalName = name.trim() || defaultName;
          net.saveAsNetwork(finalName);
          router.push(`/designer/${net.activeNetworkId || ""}`);
        },
      });
    }
  }, [net, app, stations.length, router]);

  const handleSaveAsNetwork = useCallback(() => {
    const defaultName = net.activeNetworkName
      ? `${net.activeNetworkName} (copy)`
      : `Network \u2013 ${stations.length} stations`;
    app.setModal({
      type: "prompt",
      title: "Save As New Network",
      message: "Give this copy a new name.",
      defaultValue: defaultName,
      placeholder: "Network name\u2026",
      onSubmit: (name: string) => {
        const finalName = name.trim() || defaultName;
        net.saveAsNetwork(finalName);
      },
    });
  }, [net, app, stations.length]);

  const handleNewNetwork = useCallback(() => {
    const doNew = () => {
      net.newNetwork();
      router.push("/designer");
    };
    if (stations.length > 0) {
      app.setModal({
        type: "confirm",
        title: "New Network",
        message: "Start a new empty network? Any unsaved changes will be lost.",
        onConfirm: doNew,
      });
    } else {
      doNew();
    }
  }, [stations.length, net, app, router]);

  const handleClearAll = useCallback(() => {
    if (stations.length === 0) return;
    app.setModal({
      type: "confirm",
      title: "Clear All Stations",
      message: `This will remove all ${stations.length} stations from your network. This action can be undone.`,
      onConfirm: () => {
        net.resetStations();
        app.setSelectedStationId(null);
      },
    });
  }, [stations.length, net, app]);

  const handleLoadNetwork = useCallback((network: SavedNetwork) => {
    net.loadNetwork(network);
    router.push(`/designer/${network.id}`);
  }, [net, router]);

  const handleSeedLRT = useCallback(() => {
    const lrtData = app.overlayData.lrt;
    if (!lrtData) {
      if (!app.activeOverlays.has("lrt")) {
        app.setActiveOverlays((prev) => new Set([...prev, "lrt"]));
      }
      app.setModal({ type: "alert", title: "LRT Data Loading", message: "LRT data is still loading \u2014 try again in a moment." });
      return;
    }
    const lrtPoints = lrtData.features.filter((f) => f.geometry.type === "Point");
    if (lrtPoints.length === 0) {
      app.setModal({ type: "alert", title: "No LRT Stations", message: "No LRT station points found in overlay data." });
      return;
    }
    const result = net.seedLRT(app.overlayData, app.activeOverlays);
    // Check if any were added by checking station count change
    if (net.stations.length === stations.length && lrtPoints.length > 0) {
      app.setModal({ type: "alert", title: "Already Seeded", message: "All LRT stations already have docks nearby." });
    }
  }, [app, net, stations.length]);

  // ---- Share handler ----
  const handleShare = useCallback(async () => {
    if (!net.activeNetworkId) return;
    setIsSharing(true);
    setShareError(null);
    try {
      const draft = net.buildDraft(net.activeNetworkId, net.activeNetworkName);
      const secret = generateOwnerSecret();
      const hash = await hashOwnerSecret(secret);
      const result = await apiShareNetwork(hash, draft);
      storeOwnerSecret(result.id, secret);

      const updated: SavedNetwork = {
        ...draft,
        shareId: result.id,
        sharedAt: new Date().toISOString(),
      };
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
  }, [net]);

  const handleCopyShareLink = useCallback(async () => {
    const draft = net.buildDraft(net.activeNetworkId ?? "", net.activeNetworkName);
    if (!draft.shareId) return;
    const url = `${window.location.origin}/network/${draft.shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link:", url);
    }
  }, [net]);

  // Check if current network is already shared
  const currentDraft = net.activeNetworkId ? net.buildDraft(net.activeNetworkId, net.activeNetworkName) : null;
  const isShared = !!currentDraft?.shareId;

  return (
    <div className="h-full bg-white flex flex-col">
      {/* ── Active Network bar (persistent across all modes except docs) ── */}
      {mode !== "docs" && mode !== "saved" && (
        <div className="px-4 pt-3 pb-2 border-b border-[var(--color-border)] bg-[#f8f9fa] shrink-0">
          {/* Network name (click to edit) */}
          <div className="flex items-center gap-2 mb-1.5">
            {/* Auto-save indicator */}
            <div
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: net.activeNetworkId ? "#34a853" : "#9aa0a6" }}
              title={net.lastAutoSaveAt ? `Auto-saved ${new Date(net.lastAutoSaveAt).toLocaleTimeString()}` : net.activeNetworkId ? "Saved" : "Unsaved"}
            />
            {isEditingName ? (
              <form
                className="flex-1 flex gap-1"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (editNameValue.trim()) net.renameNetwork(editNameValue.trim());
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
                    if (editNameValue.trim()) net.renameNetwork(editNameValue.trim());
                    setIsEditingName(false);
                  }}
                />
              </form>
            ) : (
              <button
                onClick={() => { setEditNameValue(net.activeNetworkName); setIsEditingName(true); }}
                className="flex-1 text-left text-[13px] font-medium text-[var(--color-fg)] hover:text-[var(--color-blue)] transition-colors truncate"
                title="Click to rename"
              >
                {net.activeNetworkName}
              </button>
            )}
          </div>
          {/* Network actions */}
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
              {net.activeNetworkId ? "Save" : "Save As\u2026"}
            </button>
            {net.activeNetworkId && (
              <button
                onClick={handleSaveAsNetwork}
                className="h-6 px-2 text-[10px] font-medium rounded text-[var(--color-secondary)] hover:text-[var(--color-fg)] hover:bg-[#e8eaed] transition-colors"
              >
                Save As\u2026
              </button>
            )}
            {/* Share button */}
            {net.activeNetworkId && (
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
            {net.lastAutoSaveAt && (
              <span className="text-[9px] text-[var(--color-secondary)] tabular-nums mr-1" title="Auto-saved">
                Auto-saved
              </span>
            )}
            <span className="text-[10px] text-[var(--color-secondary)] tabular-nums">
              {stations.length} stations
            </span>
          </div>
          {shareError && (
            <p className="text-[10px] text-red-600 mt-1">{shareError}</p>
          )}
        </div>
      )}

      {/* ── Saved networks mode ── */}
      {mode === "saved" ? (
        <div className="flex-1 flex flex-col min-h-0">
          <SidebarHeader
            title="Saved Networks"
            subtitle="Load a previously saved network draft"
          />
          <SavedNetworksList onLoad={handleLoadNetwork} activeNetworkId={net.activeNetworkId} />
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
              origin={app.origin}
              destination={app.destination}
              onSetOrigin={app.setOrigin}
              onSetDestination={app.setDestination}
              routes={app.routes}
              routeNotices={app.routeNotices}
              selectedRouteIndex={app.selectedRouteIndex}
              onSelectRoute={(i) => app.setSelectedRouteIndex(i)}
              isLoading={app.isLoadingRoutes}
              departureTime={app.departureTime}
              onSetDepartureTime={app.setDepartureTime}
              onGetDirections={app.getDirections}
              onFlyToPlace={handleFlyToPlace}
            />
          </div>
        </div>
      ) : mode === "designer" ? (
        /* ── Designer mode ── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Header + stats */}
          <div className="px-5 pt-3 pb-2 border-b border-[var(--color-border)]">
            <p className="text-[12px] text-[var(--color-secondary)]">
              Right-click map to add stations
            </p>
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
            <div className="flex items-center gap-1.5 mt-2 -mx-1">
              <IconBtn onClick={net.undo} disabled={!net.canUndo} title="Undo (Ctrl+Z)">
                <path d="M3 10h13a4 4 0 010 8H7" />
                <path d="M7 6L3 10l4 4" />
              </IconBtn>
              <IconBtn onClick={net.redo} disabled={!net.canRedo} title="Redo (Ctrl+Y)">
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
              label={`History${buildLog.length > 0 ? ` (${buildLog.length})` : ""}`}
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
                weights={net.plannerWeights}
                onUpdateWeights={net.setPlannerWeights}
                decayRadii={net.decayRadii}
                onUpdateDecayRadii={net.setDecayRadii}
                densityScales={net.densityScales}
                onUpdateDensityScales={net.setDensityScales}
                config={net.plannerConfig}
                onUpdateConfig={net.setPlannerConfig}
                showSuitability={net.showSuitability}
                onToggleSuitability={net.toggleSuitability}
                isSuitabilityLoading={net.isSuitabilityLoading}
                onRunOptimize={net.runOptimize}
                isOptimizing={net.isOptimizing}
                optimizeError={net.optimizeError}
                coverage={net.plannerCoverage}
                onApplyStations={net.applyStations}
                hasGeneratedStations={!!net.generatedStations}
                onSeedLRT={handleSeedLRT}
                stationCount={stations.length}
                onStep={net.step}
                isStepping={net.isStepping}
              />
            ) : designerTab === "history" ? (
              <BuildHistory
                buildLog={buildLog}
                stations={stations}
                onPreviewSnapshot={app.setPreviewStations}
                onRevertToSnapshot={net.revertToSnapshot}
              />
            ) : (
              <div className="flex flex-col h-full min-h-0">
                {selectedStation && (
                  <StationEditor
                    station={selectedStation}
                    autoFocusName={app.autoFocusName}
                    onUpdate={(updates) => net.updateStation(selectedStation.id, updates)}
                    onCommit={net.commitStation}
                    onDelete={() => {
                      net.deleteStation(selectedStation.id);
                      app.setSelectedStationId(null);
                    }}
                    onDeselect={() => app.setSelectedStationId(null)}
                  />
                )}
                <StationList
                  stations={stations}
                  selectedStationId={app.selectedStationId}
                  onSelectStation={app.setSelectedStationId}
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
