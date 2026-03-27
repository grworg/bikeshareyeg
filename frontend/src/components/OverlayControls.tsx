"use client";

import { useState, useRef, useEffect } from "react";
import {
  Layers,
  TrainFront,
  Bike,
  Bus,
  CircleDot,
  Store,
  GraduationCap,
  TreePine,
  Users,
  Route,
  Milestone,
  Map,
  Mountain,
} from "lucide-react";
import type { OverlayKey } from "@/lib/types";
import { useIsMobile } from "@/lib/useMediaQuery";

interface LayerInfo {
  key: OverlayKey;
  label: string;
  shortLabel: string;
  color: string;
  icon: React.ReactNode;
}

export const LAYERS: LayerInfo[] = [
  { key: "terrain", label: "Terrain (Hillshade)", shortLabel: "Terrain", color: "#6d4c41", icon: <Mountain size={14} /> },
  { key: "lrt", label: "LRT", shortLabel: "LRT", color: "#7b1fa2", icon: <TrainFront size={14} /> },
  { key: "bike", label: "Bike Paths", shortLabel: "Bikes", color: "#00897b", icon: <Bike size={14} /> },
  { key: "bus", label: "Bus Routes", shortLabel: "Bus", color: "#e65100", icon: <Bus size={14} /> },
  { key: "docks", label: "Bike Share Docks", shortLabel: "Docks", color: "#1a73e8", icon: <CircleDot size={14} /> },
  { key: "commercial", label: "Commercial & Retail", shortLabel: "Shops", color: "#f9a825", icon: <Store size={14} /> },
  { key: "education", label: "Education", shortLabel: "Schools", color: "#5c6bc0", icon: <GraduationCap size={14} /> },
  { key: "recreation", label: "Parks & Recreation", shortLabel: "Parks", color: "#43a047", icon: <TreePine size={14} /> },
  { key: "population", label: "Population Density", shortLabel: "Pop.", color: "#d32f2f", icon: <Users size={14} /> },
  { key: "motorway", label: "Motorways", shortLabel: "Motorway", color: "#c62828", icon: <Route size={14} /> },
  { key: "trunk", label: "Trunk Roads", shortLabel: "Trunk", color: "#e65100", icon: <Milestone size={14} /> },
  { key: "accessibility", label: "Accessible Areas", shortLabel: "Access", color: "#546e7a", icon: <Map size={14} /> },
];

interface OverlayControlsProps {
  activeOverlays: Set<OverlayKey>;
  loadingOverlays: Set<OverlayKey>;
  onToggle: (key: OverlayKey) => void;
}

export default function OverlayControls({
  activeOverlays,
  loadingOverlays,
  onToggle,
}: OverlayControlsProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return <MobileChipBar activeOverlays={activeOverlays} loadingOverlays={loadingOverlays} onToggle={onToggle} />;
  }

  return <DesktopDropdown activeOverlays={activeOverlays} loadingOverlays={loadingOverlays} onToggle={onToggle} />;
}

// ---------------------------------------------------------------------------
// Mobile: horizontally scrollable chip bar
// ---------------------------------------------------------------------------

function MobileChipBar({ activeOverlays, loadingOverlays, onToggle }: OverlayControlsProps) {
  return (
    <div className="absolute top-14 left-0 right-0 z-20 pointer-events-auto">
      <div className="flex gap-2 px-3 overflow-x-auto scrollbar-hide py-1" style={{ WebkitOverflowScrolling: "touch" }}>
        {LAYERS.map((layer) => {
          const active = activeOverlays.has(layer.key);
          const loading = loadingOverlays.has(layer.key);
          return (
            <button
              key={layer.key}
              onClick={() => onToggle(layer.key)}
              className={`shrink-0 h-[36px] rounded-full flex items-center gap-1.5 px-3 text-[12px] font-medium transition-all border ${
                active
                  ? "text-white border-transparent shadow-sm"
                  : "bg-[var(--color-surface)] text-[#5f6368] border-[var(--color-border)] shadow-[var(--shadow-sm)]"
              }`}
              style={active ? { backgroundColor: layer.color, borderColor: layer.color } : undefined}
            >
              {loading ? (
                <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className={active ? "text-white" : ""} style={!active ? { color: layer.color } : undefined}>
                  {layer.icon}
                </span>
              )}
              {layer.shortLabel}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Desktop: top-right dropdown (original behavior)
// ---------------------------------------------------------------------------

function DesktopDropdown({ activeOverlays, loadingOverlays, onToggle }: OverlayControlsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open]);

  const activeCount = activeOverlays.size;

  return (
    <div ref={ref} className="absolute top-3 right-3 z-30">
      <button
        onClick={() => setOpen(!open)}
        className={`w-10 h-10 rounded-lg bg-[var(--color-surface)] shadow-[var(--shadow-md)] flex items-center justify-center transition-colors ${
          open ? "ring-2 ring-[var(--color-blue)]" : "hover:bg-[var(--color-surface-hover)]"
        }`}
        title="Map layers"
      >
        <Layers size={20} className="text-[var(--color-secondary)]" />
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-blue)] text-white text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute top-12 right-0 bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-lg)] overflow-hidden animate-[fadeIn_100ms_ease] min-w-[180px]">
          <div className="px-3 py-1.5 text-[10px] font-medium text-[var(--color-secondary)] uppercase tracking-wider border-b border-[var(--color-border)]">
            Layers
          </div>
          {LAYERS.map((layer) => {
            const active = activeOverlays.has(layer.key);
            const loading = loadingOverlays.has(layer.key);
            return (
              <button
                key={layer.key}
                onClick={() => onToggle(layer.key)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  active ? "bg-[var(--color-surface-hover)]" : "hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <div
                  className="shrink-0 w-4 h-4 rounded-sm border-2 flex items-center justify-center transition-colors"
                  style={{
                    borderColor: active ? layer.color : "#dadce0",
                    backgroundColor: active ? layer.color : "transparent",
                  }}
                >
                  {active && !loading && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="white">
                      <path d="M2 5l2 2 4-4" stroke="white" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                  {loading && (
                    <div className="w-2.5 h-2.5 border border-white border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <span style={{ color: active ? layer.color : "#5f6368" }}>{layer.icon}</span>
                <span className="text-[12px] font-medium" style={{ color: active ? layer.color : "#5f6368" }}>
                  {layer.label}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export const OVERLAY_COLORS: Record<OverlayKey, [number, number, number, number]> = {
  terrain: [109, 76, 65, 160],
  lrt: [123, 31, 162, 220],
  bike: [0, 137, 123, 180],
  bus: [230, 81, 0, 120],
  commercial: [249, 168, 37, 200],
  education: [92, 107, 192, 200],
  recreation: [67, 160, 71, 200],
  population: [211, 47, 47, 160],
  docks: [26, 115, 232, 200],
  accessibility: [84, 110, 122, 120],
  motorway: [198, 40, 40, 220],
  trunk: [230, 81, 0, 200],
};

export const OVERLAY_WIDTHS: Record<OverlayKey, number> = {
  terrain: 1, lrt: 3, bike: 2.5, bus: 1.5, commercial: 1, education: 1,
  recreation: 1, population: 1, docks: 1, accessibility: 1,
  motorway: 3, trunk: 2.5,
};
