"use client";

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
// Component
// ---------------------------------------------------------------------------

export default function OverlayControls({
  activeOverlays,
  loadingOverlays,
  onToggle,
}: OverlayControlsProps) {
  return (
    <div className="absolute top-14 right-3 z-30 bg-white rounded-lg shadow-[var(--shadow-md)] overflow-hidden">
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
              active
                ? "bg-[#f1f3f4]"
                : "hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {/* Color indicator / checkbox */}
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

            {/* Icon */}
            <span style={{ color: active ? layer.color : "#5f6368" }}>
              {layer.icon}
            </span>

            {/* Label */}
            <span
              className="text-[12px] font-medium"
              style={{ color: active ? layer.color : "#5f6368" }}
            >
              {layer.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * Mapping of overlay keys to their display colors.
 * Importable by DeckMap for consistent layer styling.
 */
export const OVERLAY_COLORS: Record<OverlayKey, [number, number, number, number]> = {
  lrt: [123, 31, 162, 220],   // purple
  bike: [0, 137, 123, 180],   // teal
  bus: [230, 81, 0, 120],     // orange (more transparent since dense)
  population: [211, 47, 47, 160], // red (used as fallback, actual rendering uses density color scale)
  docks: [26, 115, 232, 200], // blue (bike share docks)
};

export const OVERLAY_WIDTHS: Record<OverlayKey, number> = {
  lrt: 3,
  bike: 2.5,
  bus: 1.5,
  population: 1,
  docks: 1,
};
