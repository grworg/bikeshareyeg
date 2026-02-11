"use client";

import type { BikeStation } from "@/lib/types";

interface StationListProps {
  stations: BikeStation[];
  selectedStationId: string | null;
  onSelectStation: (id: string) => void;
}

export default function StationList({
  stations,
  selectedStationId,
  onSelectStation,
}: StationListProps) {
  if (stations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center px-5 py-12 text-center">
        <div>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#dadce0" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="mx-auto mb-3">
            <circle cx="12" cy="12" r="10" />
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
          </svg>
          <p className="text-[13px] text-[var(--color-secondary)]">
            No stations yet
          </p>
          <p className="text-[11px] text-[var(--color-secondary)] mt-1 opacity-70">
            Right-click the map to add one, or use the Network Planner
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1">
      {stations.map((s) => {
        const pct = s.bikes / Math.max(s.capacity, 1);
        const color = pct < 0.15 || pct > 0.85 ? "#ea4335" : pct < 0.3 || pct > 0.7 ? "#fbbc04" : "#34a853";
        return (
          <button
            key={s.id}
            onClick={() => onSelectStation(s.id)}
            className={`w-full text-left px-5 py-2.5 flex items-center gap-3 border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
              s.id === selectedStationId
                ? "bg-[#e8f0fe]"
                : "hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            <div
              className="shrink-0 w-3 h-3 rounded-full border-2 border-white"
              style={{ backgroundColor: color, boxShadow: "0 0 0 1px rgba(0,0,0,0.1)" }}
            />
            <div className="flex-1 min-w-0">
              <p className="text-[13px] text-[var(--color-fg)] truncate">{s.name}</p>
            </div>
            <span className="text-[11px] text-[var(--color-secondary)] tabular-nums shrink-0">
              {s.bikes}/{s.capacity}
            </span>
          </button>
        );
      })}
    </div>
  );
}
