"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { usePathname, useRouter } from "next/navigation";
import SideNav, { MobileTabBar } from "@/components/SideNav";
import MobileSidebar from "@/components/MobileSidebar";
import MobileRoutingView from "@/components/MobileRoutingView";
import ContextMenu from "@/components/ContextMenu";
import OverlayControls from "@/components/OverlayControls";
import AppModal from "@/components/Modal";
import { useIsMobile } from "@/lib/useMediaQuery";
import { useAppStore } from "@/lib/appStore";
import { useNetworkStore } from "@/lib/networkStore";
import type { AppMode } from "@/lib/types";
import { modeFromPathname } from "@/lib/navigation";

const DeckMap = dynamic(() => import("@/components/DeckMap"), { ssr: false });

export default function AppShell({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile();
  const router = useRouter();
  const pathname = usePathname();
  const mode = modeFromPathname(pathname);

  // ---- Zustand selectors (components only re-render when selected slice changes) ----
  const flyTo = useAppStore((s) => s.flyTo);
  const selectedStationId = useAppStore((s) => s.selectedStationId);
  const contextMenu = useAppStore((s) => s.contextMenu);
  const modal = useAppStore((s) => s.modal);
  const activeOverlays = useAppStore((s) => s.activeOverlays);
  const overlayData = useAppStore((s) => s.overlayData);
  const loadingOverlays = useAppStore((s) => s.loadingOverlays);
  const origin = useAppStore((s) => s.origin);
  const destination = useAppStore((s) => s.destination);
  const routes = useAppStore((s) => s.routes);
  const selectedRouteIndex = useAppStore((s) => s.selectedRouteIndex);
  const previewStations = useAppStore((s) => s.previewStations);

  const stations = useNetworkStore((s) => s.stations);
  const plannerWeights = useNetworkStore((s) => s.plannerWeights);
  const decayRadii = useNetworkStore((s) => s.decayRadii);
  const densityScales = useNetworkStore((s) => s.densityScales);
  const plannerConfig = useNetworkStore((s) => s.plannerConfig);
  const suitabilityData = useNetworkStore((s) => s.suitabilityData);
  const showSuitability = useNetworkStore((s) => s.showSuitability);
  const activeNetworkId = useNetworkStore((s) => s.activeNetworkId);
  const canUndo = useNetworkStore((s) => s._past.length > 0);
  const canRedo = useNetworkStore((s) => s._future.length > 0);

  // ---- Init stores once ----
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;
    useNetworkStore.getState().init();
    useAppStore.getState().loadActiveOverlays();
  }, []);

  // ---- Clear selection on mode change ----
  const prevModeRef = useRef(mode);
  useEffect(() => {
    if (prevModeRef.current !== mode) {
      useAppStore.getState().clearSelection();
      prevModeRef.current = mode;
    }
  }, [mode]);

  // ---- Clear selection if station removed (e.g. by undo) ----
  useEffect(() => {
    if (selectedStationId && !stations.some((s) => s.id === selectedStationId)) {
      useAppStore.getState().setSelectedStationId(null);
    }
  }, [stations, selectedStationId]);

  // ---- Keyboard shortcuts ----
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

      if (e.key === "Escape") {
        const s = useAppStore.getState();
        if (s.modal) { s.closeModal(); return; }
        if (s.contextMenu) { s.setContextMenu(null); return; }
        if (s.selectedStationId) { s.setSelectedStationId(null); return; }
        return;
      }

      const currentMode = modeFromPathname(window.location.pathname);
      if (currentMode === "designer" && e.key === "z" && (e.ctrlKey || e.metaKey) && !e.shiftKey) {
        e.preventDefault(); useNetworkStore.getState().undo(); return;
      }
      if (currentMode === "designer" && ((e.key === "y" && (e.ctrlKey || e.metaKey)) || (e.key === "z" && (e.ctrlKey || e.metaKey) && e.shiftKey))) {
        e.preventDefault(); useNetworkStore.getState().redo(); return;
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ---- Mobile sidebar ----
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const isLoadingRoutes = useAppStore((s) => s.isLoadingRoutes);

  // Auto-expand sheet when routes arrive on mobile
  const prevRoutesLen = useRef(routes.length);
  useEffect(() => {
    if (isMobile && routes.length > 0 && prevRoutesLen.current === 0) {
      setMobileSidebarOpen(true);
    }
    prevRoutesLen.current = routes.length;
  }, [isMobile, routes.length]);

  const handleMobileTab = useCallback(
    (m: AppMode) => {
      if (m === "docs") { router.push("/docs"); return; }
      const targetPath = m === "routing"
        ? (activeNetworkId ? `/routing/${activeNetworkId}` : "/routing")
        : m === "saved" ? "/saved"
        : activeNetworkId ? `/designer/${activeNetworkId}` : "/designer";
      if (m === "routing") {
        router.push(targetPath);
        return;
      }
      if (m === mode) {
        setMobileSidebarOpen((o) => !o);
      } else {
        router.push(targetPath);
        setMobileSidebarOpen(true);
      }
    },
    [mode, router, activeNetworkId],
  );

  // ---- Station interactions ----
  const handleStationClick = useCallback((stationId: string) => {
    useAppStore.getState().setContextMenu(null);
    useAppStore.getState().setSelectedStationId(stationId);
    useAppStore.getState().setAutoFocusName(false);
  }, []);

  const handleStationDragEnd = useCallback(
    (stationId: string, lngLat: { lng: number; lat: number }) => {
      useNetworkStore.getState().moveStation(stationId, lngLat);
    },
    [],
  );

  const handleAddStationAt = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      const newId = useNetworkStore.getState().addStationAt(lngLat);
      useAppStore.getState().setSelectedStationId(newId);
      useAppStore.getState().setAutoFocusName(true);
    },
    [],
  );

  // Mobile: directly place a station without ContextMenu
  const handleMobileAddStation = useCallback(
    (lngLat: { lng: number; lat: number }) => {
      const newId = useNetworkStore.getState().addStationAt(lngLat);
      useAppStore.getState().setSelectedStationId(newId);
      useAppStore.getState().setAutoFocusName(false);
    },
    [],
  );

  // Wait for hydration so we know the correct layout before rendering
  if (isMobile === undefined) {
    return <main className="h-screen w-screen bg-[var(--color-surface)]" />;
  }

  // ---- Derived ----
  const isDesigner = mode === "designer";
  const displayStations = previewStations ?? stations;
  const selectedRoute = selectedRouteIndex !== null ? (routes[selectedRouteIndex] ?? null) : null;
  const originLatLng = origin ? { lat: origin.lat, lng: origin.lng } : null;
  const destLatLng = destination ? { lat: destination.lat, lng: destination.lng } : null;

  // ---- Map content ----
  const mapContent = (
    <>
      <DeckMap
        stations={displayStations}
        origin={mode === "routing" ? originLatLng : null}
        destination={mode === "routing" ? destLatLng : null}
        selectedRoute={mode === "routing" ? selectedRoute : null}
        flyTo={flyTo}
        onMapClick={useAppStore.getState().fireMapClick}
        onRightClick={isDesigner ? useAppStore.getState().fireMapRightClick : undefined}
        onAddStationAt={isDesigner && isMobile ? handleMobileAddStation : undefined}
        designerMode={isDesigner}
        isMobile={isMobile}
        selectedStationId={selectedStationId}
        onStationClick={handleStationClick}
        onDeleteStation={useNetworkStore.getState().deleteStation}
        onStationDragEnd={handleStationDragEnd}
        overlayData={overlayData}
        activeOverlays={activeOverlays}
        suitabilityData={suitabilityData}
        suitabilityWeights={plannerWeights}
        suitabilityDecayRadii={decayRadii}
        suitabilityDensityScales={densityScales}
        suitabilityConfig={plannerConfig}
        showSuitability={showSuitability && isDesigner}
        onUndo={useNetworkStore.getState().undo}
        onRedo={useNetworkStore.getState().redo}
        canUndo={canUndo}
        canRedo={canRedo}
      />
      <OverlayControls
        activeOverlays={activeOverlays}
        loadingOverlays={loadingOverlays}
        onToggle={useAppStore.getState().toggleOverlay}
      />
      {contextMenu && isDesigner && (
        <ContextMenu
          menu={contextMenu}
          onAddStation={handleAddStationAt}
          onClose={() => useAppStore.getState().setContextMenu(null)}
        />
      )}
    </>
  );

  // ===========================================================================
  // Render
  // ===========================================================================

  const isDocs = mode === "docs";

  if (isMobile) {
    if (isDocs) {
      return (
        <main className="relative h-dvh w-screen flex flex-col">
          <div className="flex-1 min-h-0 overflow-hidden">
            {children}
          </div>
          <MobileTabBar mode={mode} onChangeMode={handleMobileTab} />
          <AppModal modal={modal} onClose={useAppStore.getState().closeModal} />
        </main>
      );
    }
    const isRouting = mode === "routing";
    const totalBikes = isDesigner ? stations.reduce((sum, s) => sum + s.bikes, 0) : 0;
    return (
      <main className="relative h-dvh w-screen flex flex-col">
        <div
          className="flex-1 relative min-h-0 overflow-hidden"
          onPointerDown={!isRouting && mobileSidebarOpen ? () => setMobileSidebarOpen(false) : undefined}
        >
          {mapContent}
          {isRouting && <MobileRoutingView />}
          {!isRouting && (
            <MobileSidebar
              open={mobileSidebarOpen}
              onClose={() => setMobileSidebarOpen(false)}
            >
              {children}
            </MobileSidebar>
          )}
          {isRouting && <div className="sr-only">{children}</div>}
        </div>

        {/* Pull-up hint bar: shown when designer sidebar is closed */}
        {isDesigner && !mobileSidebarOpen && !isRouting && (
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="flex items-center justify-center gap-2 bg-[var(--color-surface)] shadow-[0_-2px_8px_rgba(0,0,0,0.08)] rounded-t-xl px-4 py-2"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="18 15 12 9 6 15" />
            </svg>
            <span className="text-[12px] font-medium text-[var(--color-fg)]">
              {stations.length} station{stations.length !== 1 ? "s" : ""} &middot; {totalBikes} bike{totalBikes !== 1 ? "s" : ""}
            </span>
          </button>
        )}

        <MobileTabBar mode={mode} onChangeMode={handleMobileTab} />
        <AppModal modal={modal} onClose={useAppStore.getState().closeModal} />
      </main>
    );
  }

  if (isDocs) {
    return (
      <main className="relative h-screen w-screen overflow-hidden flex">
        <SideNav />
        <div className="flex-1 min-w-0 h-full">
          {children}
        </div>
        <AppModal modal={modal} onClose={useAppStore.getState().closeModal} />
      </main>
    );
  }

  const SIDEBAR_W = 380;
  const NAV_W = 48;
  const panelLeft = NAV_W + SIDEBAR_W;

  return (
    <main className="relative h-screen w-screen overflow-hidden">
      <div className="relative z-10 flex h-full w-fit">
        <SideNav />
        <div
          className="h-full shrink-0 bg-[var(--color-surface)] shadow-[2px_0_8px_rgba(0,0,0,0.08)]"
          style={{ width: SIDEBAR_W }}
        >
          {children}
        </div>
      </div>
      <div className="absolute top-0 right-0 bottom-0 flex flex-col" style={{ left: panelLeft }}>
        {mapContent}
      </div>
      <AppModal modal={modal} onClose={useAppStore.getState().closeModal} />
    </main>
  );
}
