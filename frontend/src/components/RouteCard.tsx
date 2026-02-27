"use client";

import { Clock, TrendingUp, TrendingDown, Bike as BikeIcon } from "lucide-react";
import type { RouteOption } from "@/lib/types";
import { fmtDuration, fmtDistance } from "@/lib/types";
import { MODE_CONFIG } from "@/lib/constants";
import { legColor, legLabel, legIcon } from "@/lib/routeHelpers";
import ElevationProfile from "@/components/ElevationProfile";

interface RouteCardProps {
  route: RouteOption;
  isSelected: boolean;
  onClick: () => void;
  compact?: boolean;
}

export default function RouteCard({
  route,
  isSelected,
  onClick,
  compact = false,
}: RouteCardProps) {
  const cfg = MODE_CONFIG[route.mode] || MODE_CONFIG.walk;
  const duration = fmtDuration(route.total_duration_s);
  const distance = fmtDistance(route.total_distance_m);
  const hasTransit = route.legs.some((l) => l.mode === "lrt" || l.mode === "bus");

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
        isSelected
          ? "bg-[var(--color-active-bg)] border-l-[3px] border-l-[var(--color-blue)]"
          : "hover:bg-[var(--color-surface-hover)] border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span style={{ color: cfg.color }}>{cfg.icon}</span>
          <span className="text-[13px] font-medium" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="text-right">
          <span className={`${compact ? "text-[15px] font-semibold" : "text-[15px] font-medium"} text-[var(--color-fg)]`}>
            {duration}
          </span>
          {route.departure_time && route.arrival_time && (
            <div className="text-[11px] text-[var(--color-secondary)]">
              {route.departure_time} → {route.arrival_time}
            </div>
          )}
        </div>
      </div>

      {/* Metrics row */}
      <div className="mt-1 flex items-center gap-3 text-[12px] text-[var(--color-secondary)]">
        <span>{distance}</span>
        {route.walk_distance_m > 0 && route.mode !== "walk" && (
          <span>· {fmtDistance(route.walk_distance_m)} {compact ? "walk" : "walking"}</span>
        )}
        {!compact && route.total_ascent_m != null && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px]">
            <span className="flex items-center gap-0.5">
              <TrendingUp size={9} className="text-[#34a853]" />
              {Math.round(route.total_ascent_m)}m
            </span>
            <span className="flex items-center gap-0.5">
              <TrendingDown size={9} className="text-[#ea4335]" />
              {Math.round(route.total_descent_m ?? 0)}m
            </span>
          </span>
        )}
      </div>

      {/* Leg progress bar */}
      {route.legs.length > 1 && (
        <div className="mt-2 flex items-center gap-1">
          {route.legs
            .filter((l) => l.mode !== "wait")
            .map((leg, i) => {
              const w = Math.max(15, (leg.duration_s / route.total_duration_s) * 100);
              return (
                <div
                  key={i}
                  className="h-1.5 rounded-full"
                  style={{
                    width: `${w}%`,
                    backgroundColor: legColor(leg, route.mode),
                    opacity: leg.mode === "walk" ? 0.4 : 1,
                  }}
                  title={`${legLabel(leg)}: ${fmtDuration(leg.duration_s)}`}
                />
              );
            })}
        </div>
      )}

      {/* Transit details — desktop only */}
      {!compact && hasTransit && (
        <div className="mt-2 space-y-1">
          {route.legs.map((leg, i) => {
            if (leg.mode === "lrt" || leg.mode === "bus") {
              const color = leg.transit_color
                ? `#${leg.transit_color}`
                : leg.mode === "bus"
                  ? "#0b8043"
                  : "#7b1fa2";
              return (
                <div key={i} className="flex items-center gap-2 text-[11px]">
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: color }}
                  />
                  <span className="text-[12px]">{legIcon(leg)}</span>
                  <span className="font-medium" style={{ color }}>
                    {leg.transit_route || (leg.mode === "bus" ? "Bus" : "LRT")}
                  </span>
                  <span className="text-[var(--color-secondary)]">
                    {leg.transit_board_stop}
                  </span>
                  <span className="text-[var(--color-secondary)]">
                    {leg.transit_board_time}
                  </span>
                  <span className="text-[var(--color-secondary)]">→</span>
                  <span className="text-[var(--color-secondary)]">
                    {leg.transit_alight_stop}
                  </span>
                  <span className="text-[var(--color-secondary)]">
                    {leg.transit_alight_time}
                  </span>
                  {leg.transit_num_stops && (
                    <span className="text-[var(--color-secondary)] ml-auto">
                      {leg.transit_num_stops} stops
                    </span>
                  )}
                </div>
              );
            }
            if (leg.mode === "wait" && leg.wait_until) {
              return (
                <div key={i} className="text-[11px] text-[var(--color-secondary)] flex items-center gap-2">
                  <Clock size={10} className="text-[var(--color-secondary)]" />
                  Wait until {leg.wait_until} ({fmtDuration(leg.duration_s)})
                </div>
              );
            }
            return null;
          })}
          {route.legs
            .filter((l) => l.mode === "lrt" || l.mode === "bus")
            .map(
              (l, i) =>
                l.transit_headsign && (
                  <div key={`hs-${i}`} className="text-[10px] text-[var(--color-secondary)]">
                    towards {l.transit_headsign}
                  </div>
                ),
            )}
        </div>
      )}

      {/* Bike share station info — desktop only */}
      {!compact && route.pickup_station && route.dropoff_station && (
        <div className="mt-1.5 text-[11px] text-[var(--color-secondary)] flex items-center gap-1">
          <BikeIcon size={11} className="text-[var(--color-blue)]" /> {route.pickup_station.name} → {route.dropoff_station.name}
        </div>
      )}
      {!compact && route.pickup_station && !route.dropoff_station && (
        <div className="mt-1.5 text-[11px] text-[var(--color-secondary)] flex items-center gap-1">
          <BikeIcon size={11} className="text-[var(--color-blue)]" /> from {route.pickup_station.name}
        </div>
      )}
      {!compact && !route.pickup_station && route.dropoff_station && (
        <div className="mt-1.5 text-[11px] text-[var(--color-secondary)] flex items-center gap-1">
          <BikeIcon size={11} className="text-[var(--color-blue)]" /> to {route.dropoff_station.name}
        </div>
      )}

      {/* Elevation profile — selected desktop routes only */}
      {!compact && isSelected && route.elevation_profile && route.elevation_profile.length >= 2 && (
        <ElevationProfile
          profile={route.elevation_profile}
          totalAscent={route.total_ascent_m}
          totalDescent={route.total_descent_m}
          height={90}
          color={cfg.color}
        />
      )}
    </button>
  );
}
