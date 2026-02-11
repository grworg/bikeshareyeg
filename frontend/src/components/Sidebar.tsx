"use client";

import { useState } from "react";

interface SidebarProps {
  simResults?: {
    total_trips: number;
    successful_trips: number;
    failed_trips: number;
    service_rate: number;
    avg_trip_duration: number;
  } | null;
  stationCount: number;
  layers: {
    bikeNetwork: boolean;
    stations: boolean;
    trips: boolean;
    hexDemand: boolean;
  };
  onToggleLayer: (layer: string) => void;
  onRunSimulation: () => void;
  onOptimizePlacement: () => void;
  onClearStations: () => void;
  isSimulating: boolean;
}

export default function Sidebar({
  simResults,
  stationCount,
  layers,
  onToggleLayer,
  onRunSimulation,
  onOptimizePlacement,
  onClearStations,
  isSimulating,
}: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false);

  if (collapsed) {
    return (
      <button
        onClick={() => setCollapsed(false)}
        className="absolute top-4 left-4 z-30 bg-white rounded-full w-10 h-10 flex items-center justify-center shadow-[var(--shadow-md)] hover:bg-[var(--color-surface-hover)] transition-colors"
        aria-label="Open panel"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
      </button>
    );
  }

  return (
    <aside className="absolute top-2 left-2 bottom-2 z-30 w-[360px] bg-white rounded-lg shadow-[var(--shadow-lg)] flex flex-col overflow-hidden">
      {/* Header — Google Maps-style search bar look */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
        <button
          onClick={() => setCollapsed(true)}
          className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors"
          aria-label="Close panel"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
        </button>
        <div className="min-w-0">
          <h1 className="text-[15px] font-medium text-[var(--color-fg)] leading-tight truncate">
            BikeShareYEG
          </h1>
          <p className="text-xs text-[var(--color-secondary)] leading-tight mt-0.5">
            Edmonton Bike-Share Network Planner
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Layer Toggles */}
        <section className="px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider mb-2.5">
            Map layers
          </h2>
          <div className="space-y-1">
            {[
              { key: "bikeNetwork", label: "Bike network", icon: "M3 17l4-4 4 4 4-4 4 4" },
              { key: "stations", label: "Stations", icon: "M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" },
              { key: "trips", label: "Trip arcs", icon: "M21 12c-1.5 0-2.5 1-2.5 1s-1-1-2.5-1-2.5 1-2.5 1-1-1-2.5-1-2.5 1-2.5 1-1-1-2.5-1-2.5 1-2.5 1" },
              { key: "hexDemand", label: "Demand heatmap", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
            ].map(({ key, label }) => (
              <label
                key={key}
                className="flex items-center gap-3 px-2 py-2 rounded-md cursor-pointer hover:bg-[var(--color-surface-hover)] transition-colors"
              >
                <input
                  type="checkbox"
                  checked={layers[key as keyof typeof layers]}
                  onChange={() => onToggleLayer(key)}
                  className="w-4 h-4 rounded accent-[var(--color-blue)] cursor-pointer"
                />
                <span className="text-[13px] text-[var(--color-fg)]">{label}</span>
              </label>
            ))}
          </div>
        </section>

        {/* Station Placement */}
        <section className="px-4 py-3 border-b border-[var(--color-border)]">
          <h2 className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider mb-2.5">
            Station placement
          </h2>
          <p className="text-[13px] text-[var(--color-secondary)] mb-3">
            Click the map to place stations.
            <span className="ml-1 text-[var(--color-fg)] font-medium">{stationCount}</span> placed.
          </p>
          <div className="flex flex-col gap-2">
            <button
              onClick={onOptimizePlacement}
              disabled={isSimulating}
              className="w-full h-9 text-[13px] font-medium rounded-full border border-[var(--color-border)] text-[var(--color-blue)] hover:bg-blue-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Auto-optimize placement
            </button>
            <button
              onClick={onRunSimulation}
              disabled={isSimulating || stationCount < 2}
              className="w-full h-9 text-[13px] font-medium rounded-full bg-[var(--color-blue)] text-white hover:bg-[var(--color-blue-hover)] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isSimulating ? "Running simulation..." : "Run simulation"}
            </button>
            <button
              onClick={onClearStations}
              className="w-full h-9 text-[13px] font-medium rounded-full border border-[var(--color-border)] text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              Clear all stations
            </button>
          </div>
        </section>

        {/* Simulation Results */}
        {simResults && (
          <section className="px-4 py-3 border-b border-[var(--color-border)]">
            <h2 className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider mb-3">
              Simulation results
            </h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3">
              <Stat label="Total trips" value={simResults.total_trips.toLocaleString()} />
              <Stat label="Successful" value={simResults.successful_trips.toLocaleString()} color="green" />
              <Stat label="Failed" value={simResults.failed_trips.toLocaleString()} color="red" />
              <Stat
                label="Service rate"
                value={`${(simResults.service_rate * 100).toFixed(1)}%`}
                color={simResults.service_rate > 0.8 ? "green" : simResults.service_rate > 0.5 ? "default" : "red"}
              />
              <Stat
                label="Avg trip duration"
                value={`${simResults.avg_trip_duration.toFixed(1)} min`}
                span2
              />
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--color-border)] bg-[#f8f9fa]">
        <p className="text-[11px] text-[var(--color-secondary)] leading-relaxed">
          Data: OpenStreetMap, City of Edmonton Open Data, Statistics Canada
        </p>
      </div>
    </aside>
  );
}

function Stat({
  label,
  value,
  color = "default",
  span2 = false,
}: {
  label: string;
  value: string | number;
  color?: "default" | "green" | "red";
  span2?: boolean;
}) {
  const colorClass =
    color === "green"
      ? "text-[var(--color-green)]"
      : color === "red"
        ? "text-[var(--color-red)]"
        : "text-[var(--color-fg)]";

  return (
    <div className={span2 ? "col-span-2" : ""}>
      <p className="text-[11px] text-[var(--color-secondary)] leading-tight">{label}</p>
      <p className={`text-[18px] font-medium leading-snug ${colorClass}`}>
        {String(value)}
      </p>
    </div>
  );
}
