"use client";

import { useState, useRef, useEffect } from "react";
import type { OverlayKey } from "@/lib/types";

// ---------------------------------------------------------------------------
// Layer definitions
// ---------------------------------------------------------------------------

interface LayerInfo {
  key: OverlayKey;
  label: string;
  color: string;
  icon: React.ReactNode;
}

const LAYERS: LayerInfo[] = [
  {
    key: "lrt",
    label: "LRT",
    color: "#7b1fa2",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="4" y="3" width="16" height="14" rx="2" />
        <path d="M4 11h16M9 21l-2-4M15 21l2-4M12 3v4" />
      </svg>
    ),
  },
  {
    key: "bike",
    label: "Bike Paths",
    color: "#00897b",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="5.5" cy="17.5" r="3.5" />
        <circle cx="18.5" cy="17.5" r="3.5" />
        <path d="M15 6a1 1 0 100-2 1 1 0 000 2zM12 17.5V14l-3-3 4-3 2 3h3" />
      </svg>
    ),
  },
  {
    key: "bus",
    label: "Bus Routes",
    color: "#e65100",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <rect x="3" y="3" width="18" height="14" rx="2" />
        <path d="M3 10h18M8 21v-4M16 21v-4M7 14h.01M17 14h.01" />
      </svg>
    ),
  },
  {
    key: "docks",
    label: "Bike Share Docks",
    color: "#1a73e8",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <circle cx="12" cy="12" r="10" />
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
      </svg>
    ),
  },
  {
    key: "commercial",
    label: "Commercial & Retail",
    color: "#f9a825",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
  },
  {
    key: "education",
    label: "Education",
    color: "#5c6bc0",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
        <path d="M6 12v5c0 1.66 2.69 3 6 3s6-1.34 6-3v-5" />
      </svg>
    ),
  },
  {
    key: "recreation",
    label: "Parks & Recreation",
    color: "#43a047",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M17 14l3-3-3-3M7 14l-3-3 3-3" />
        <path d="M12 2v6M12 16v6M8 8l4 4 4-4" />
      </svg>
    ),
  },
  {
    key: "population",
    label: "Population Density",
    color: "#d32f2f",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75" />
      </svg>
    ),
  },
  {
    key: "motorway",
    label: "Motorways",
    color: "#c62828",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 12h16" />
        <path d="M4 6h16" />
        <path d="M4 18h16" />
      </svg>
    ),
  },
  {
    key: "trunk",
    label: "Trunk Roads",
    color: "#e65100",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M4 12h16" />
        <path d="M8 6l-4 6 4 6" />
        <path d="M16 6l4 6-4 6" />
      </svg>
    ),
  },
  {
    key: "accessibility",
    label: "Accessible Areas",
    color: "#546e7a",
    icon: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <path d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7" />
        <path d="M15 4l5.447 2.724A1 1 0 0121 7.618v10.764a1 1 0 01-1.447.894L15 17" />
        <path d="M9 7v13M15 4v13" />
      </svg>
    ),
  },
];

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OverlayControlsProps {
  activeOverlays: Set<OverlayKey>;
  loadingOverlays: Set<OverlayKey>;
  onToggle: (key: OverlayKey) => void;
}

// ---------------------------------------------------------------------------
// Component — popover toggle button + dropdown
// ---------------------------------------------------------------------------

export default function OverlayControls({
  activeOverlays,
  loadingOverlays,
  onToggle,
}: OverlayControlsProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const activeCount = activeOverlays.size;

  return (
    <div ref={ref} className="absolute top-3 right-3 z-30">
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className={`w-10 h-10 rounded-lg bg-white shadow-[var(--shadow-md)] flex items-center justify-center transition-colors ${
          open ? "ring-2 ring-[var(--color-blue)]" : "hover:bg-[var(--color-surface-hover)]"
        }`}
        title="Map layers"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2L2 7l10 5 10-5-10-5z" />
          <path d="M2 17l10 5 10-5" />
          <path d="M2 12l10 5 10-5" />
        </svg>
        {activeCount > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[var(--color-blue)] text-white text-[9px] font-bold flex items-center justify-center">
            {activeCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-12 right-0 bg-white rounded-lg shadow-[var(--shadow-lg)] overflow-hidden animate-[fadeIn_100ms_ease] min-w-[180px]">
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
                  active ? "bg-[#f1f3f4]" : "hover:bg-[var(--color-surface-hover)]"
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

/**
 * Mapping of overlay keys to their display colors.
 * Importable by DeckMap for consistent layer styling.
 */
export const OVERLAY_COLORS: Record<OverlayKey, [number, number, number, number]> = {
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
  lrt: 3,
  bike: 2.5,
  bus: 1.5,
  commercial: 1,
  education: 1,
  recreation: 1,
  population: 1,
  docks: 1,
  accessibility: 1,
  motorway: 3,
  trunk: 2.5,
};
