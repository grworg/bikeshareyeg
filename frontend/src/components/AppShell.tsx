"use client";

import { useCallback, useEffect } from "react";
import dynamic from "next/dynamic";
import SideNav, { MobileTabBar } from "@/components/SideNav";
import MobileSidebar from "@/components/MobileSidebar";
import ContextMenu from "@/components/ContextMenu";
import OverlayControls from "@/components/OverlayControls";
import AppModal from "@/components/Modal";
import { useIsMobile } from "@/lib/useMediaQuery";
import { useApp } from "@/lib/AppContext";
import { useNetwork } from "@/lib/NetworkContext";
import { useState } from "react";
import type { AppMode } from "@/lib/types";
import { useRouter } from "next/navigation";

const DeckMap = dynamic(() => import("@/components/DeckMap"), { ssr: false });

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const app = useApp();
  const net = useNetwork();
  const { mode } = app;

  // ---- Mobile sidebar open/close ----
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const handleMobileTab = useCallback(
    (m: AppMode) => {
      if (m === "docs") {
        router.push("/docs");
        return;
      }
      const targetPath = m === "routing" ? "/routing" : m === "saved" ? "/saved"
        : net.activeNetworkId ? `/designer/${net.activeNetworkId}` : "/designer";

      if (m === mode) {
        setMobileSidebarOpen((o) => !o);
      } else {
        router.push(targetPath);
        setMobileSidebarOpen(true);
      }
    },
    [mode, router, net.activeNetworkId],
  );

  // ---- Clear selection if station removed (e.g. by undo) ----
  useEffect(() => {
    if (app.selectedStationId && !net.stations.some((s) => s.id === app.selectedStationId)) {
      app.setSelectedStationId(null);
    }
  }, [net.stations, app.selectedStationId, app]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        if (app.modal) { app.closeModal(); return; }
        if (app.contextMenu) { app.setContextMenu(null); return; }
        if (app.selectedStationId) { app.setSelectedStationId(null); return; }
        return;
      }

      if (mode === "designer" && e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); net.undo(); return;
      }
      if (mode === "designer" && ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey))) {
        e.preventDefault(); net.redo(); return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [mode, app, net]);

  // ---- Map click handler that delegates to page-registered callbacks ----
  const handleMapClick = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      app.mapCallbacks.onMapClick?.(lngLat);
    },
    [app.mapCallbacks],
  );

  const handleRightClick = useCallback(
    (info: { screenX: number; screenY: number; lng: number; lat: number }) => {
      app.mapCallbacks.onRightClick?.(info);
    },
    [app.mapCallbacks],
  );

  // ---- Station interactions (shared across all map modes) ----
  const handleStationClick = useCallback((stationId: string) => {
    app.setContextMenu(null);
    app.setSelectedStationId(stationId);
    app.setAutoFocusName(false);
  }, [app]);

  const handleStationDragEnd = useCallback(
    (stationId: string, lngLat: { lng: number; lat: number }) => {
      net.moveStation(stationId, lngLat);
    },
    [net],
  );

  const handleAddStationAt = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      const newId = net.addStationAt(lngLat);
      app.setSelectedStationId(newId);
      app.setAutoFocusName(true);
    },
    [net, app],
  );

  // ---- Map content ----
  const isDesigner = mode === "designer";
  const displayStations = app.previewStations ?? net.stations;

  const mapContent = (
    <>
      <DeckMap
        stations={displayStations}
        origin={mode === "routing" ? app.originLatLng : null}
        destination={mode === "routing" ? app.destLatLng : null}
        selectedRoute={mode === "routing" ? app.selectedRoute : null}
        flyTo={app.flyTo}
        onMapClick={handleMapClick}
        onRightClick={isDesigner ? handleRightClick : undefined}
        designerMode={isDesigner}
        selectedStationId={app.selectedStationId}
        onStationClick={handleStationClick}
        onDeleteStation={net.deleteStation}
        onStationDragEnd={handleStationDragEnd}
        overlayData={app.overlayData}
        activeOverlays={app.activeOverlays}
        suitabilityData={net.suitabilityData}
        suitabilityWeights={net.plannerWeights}
        suitabilityDecayRadii={net.decayRadii}
        suitabilityDensityScales={net.densityScales}
        suitabilityConfig={net.plannerConfig}
        showSuitability={net.showSuitability && isDesigner}
      />
      <OverlayControls
        activeOverlays={app.activeOverlays}
        loadingOverlays={app.loadingOverlays}
        onToggle={app.toggleOverlay}
      />
      {app.contextMenu && isDesigner && (
        <ContextMenu
          menu={app.contextMenu}
          onAddStation={handleAddStationAt}
          onClose={() => app.setContextMenu(null)}
        />
      )}
    </>
  );

  // ===========================================================================
  // Render
  // ===========================================================================

  if (isMobile) {
    return (
      <main className="relative h-screen w-screen flex flex-col">
        <div className="flex-1 relative min-h-0">
          {mapContent}
        </div>

        <MobileSidebar
          open={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
        >
          {children}
        </MobileSidebar>

        <MobileTabBar mode={mode} onChangeMode={handleMobileTab} />
        <AppModal modal={app.modal} onClose={app.closeModal} />
      </main>
    );
  }

  // Desktop layout
  const SIDEBAR_W = 380;
  const NAV_W = 48;
  const panelLeft = NAV_W + SIDEBAR_W;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <div className="relative z-10 flex h-full w-fit">
        <SideNav />
        <div
          className="h-full shrink-0 bg-white shadow-[2px_0_8px_rgba(0,0,0,0.08)]"
          style={{ width: SIDEBAR_W }}
        >
          {children}
        </div>
      </div>

      <div className="absolute top-0 right-0 bottom-0 flex flex-col" style={{ left: panelLeft }}>
        {mapContent}
      </div>

      <AppModal modal={app.modal} onClose={app.closeModal} />
    </main>
  );
}
