"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import type { GeocodedPlace, RouteOption, RouteLeg } from "@/lib/types";
import { fmtDuration, fmtDistance } from "@/lib/types";
import { geocode } from "@/lib/api";
import { MODE_CONFIG } from "@/lib/constants";
import ElevationProfile from "@/components/ElevationProfile";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface SearchPanelProps {
  origin: GeocodedPlace | null;
  destination: GeocodedPlace | null;
  onSetOrigin: (place: GeocodedPlace | null) => void;
  onSetDestination: (place: GeocodedPlace | null) => void;
  routes: RouteOption[];
  routeNotices: string[];
  selectedRouteIndex: number | null;
  onSelectRoute: (index: number) => void;
  isLoading: boolean;
  departureTime: string | null;
  onSetDepartureTime: (time: string | null) => void;
  onGetDirections: () => void;
  onFlyToPlace: (place: GeocodedPlace) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SearchPanel({
  origin,
  destination,
  onSetOrigin,
  onSetDestination,
  routes,
  selectedRouteIndex,
  onSelectRoute,
  routeNotices,
  isLoading,
  departureTime,
  onSetDepartureTime,
  onGetDirections,
  onFlyToPlace,
}: SearchPanelProps) {
  // Wrap onSetOrigin/Destination so autocomplete selections also trigger fly-to
  const handleOriginSelect = useCallback(
    (place: GeocodedPlace | null) => {
      onSetOrigin(place);
      if (place) onFlyToPlace(place);
    },
    [onSetOrigin, onFlyToPlace],
  );
  const handleDestSelect = useCallback(
    (place: GeocodedPlace | null) => {
      onSetDestination(place);
      if (place) onFlyToPlace(place);
    },
    [onSetDestination, onFlyToPlace],
  );

  const showGetDirections = !!origin && !!destination && routes.length === 0 && !isLoading;

  return (
    <div className="flex flex-col">
      {/* Search card */}
      <div className="overflow-visible">
        {/* Inputs */}
        <div className="flex">
          {/* Left gutter with dots + connector line */}
          <div className="flex flex-col items-center pt-5 pb-4 pl-3.5 pr-1 shrink-0">
            <div className="w-3 h-3 rounded-full bg-[var(--color-blue)] border-2 border-white shadow-sm" />
            <div className="flex-1 w-px bg-[var(--color-border)] my-1 min-h-[12px]" />
            <div className="w-3 h-3 rounded-sm bg-[var(--color-red)] border-2 border-white shadow-sm" />
          </div>

          {/* Input fields */}
          <div className="flex-1 flex flex-col py-2 pr-2">
            <PlaceInput
              placeholder="Choose starting point, or click the map"
              value={origin}
              onSelect={handleOriginSelect}
              onSelectFromMap={onSetOrigin}
            />
            <PlaceInput
              placeholder="Choose destination"
              value={destination}
              onSelect={handleDestSelect}
              onSelectFromMap={onSetDestination}
            />
          </div>
        </div>

        {/* Departure time picker */}
        <div className="flex items-center gap-2 px-4 pb-2.5 -mt-0.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#5f6368"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span className="text-[12px] text-[var(--color-secondary)]">Depart</span>
          <input
            type="datetime-local"
            value={departureTime ?? ""}
            onChange={(e) => onSetDepartureTime(e.target.value || null)}
            className="text-[12px] text-[var(--color-fg)] bg-transparent border border-[var(--color-border)] rounded px-2 py-1 outline-none focus:border-[var(--color-blue)] transition-colors"
          />
          {departureTime && (
            <button
              onClick={() => onSetDepartureTime(null)}
              className="text-[11px] text-[var(--color-blue)] hover:underline"
            >
              Now
            </button>
          )}
        </div>

        {/* Get Directions button */}
        {showGetDirections && (
          <div className="px-4 pb-3 -mt-0.5">
            <button
              onClick={onGetDirections}
              className="w-full py-2.5 rounded-lg bg-[var(--color-blue)] text-white text-[14px] font-medium hover:bg-[#1765cc] active:bg-[#1558b0] transition-colors shadow-sm"
            >
              Get Directions
            </button>
          </div>
        )}

        {/* Hint when no points set */}
        {!origin && !destination && (
          <div className="px-4 pb-3 -mt-1">
            <p className="text-[12px] text-[var(--color-secondary)]">
              Click anywhere on the map to set your starting point
            </p>
          </div>
        )}
      </div>

      {/* Route results */}
      {(routes.length > 0 || isLoading) && (
        <div className="border-t border-[var(--color-border)]">
          {isLoading ? (
            <div className="px-4 py-6 text-center">
              <div className="inline-block w-5 h-5 border-2 border-[var(--color-blue)] border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-[var(--color-secondary)] mt-2">
                Computing routes...
              </p>
            </div>
          ) : (
            <div>
              {routeNotices.length > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                  {routeNotices.map((n, i) => (
                    <p key={i} className="text-[12px] text-amber-700 leading-relaxed">
                      {n}
                    </p>
                  ))}
                </div>
              )}
              {routes.map((route, i) => (
                <RouteCard
                  key={`${route.mode}-${i}`}
                  route={route}
                  isSelected={selectedRouteIndex === i}
                  onClick={() => onSelectRoute(i)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// PlaceInput with autocomplete dropdown
// ---------------------------------------------------------------------------

function PlaceInput({
  placeholder,
  value,
  onSelect,
  onSelectFromMap,
}: {
  placeholder: string;
  value: GeocodedPlace | null;
  /** Called when user picks from autocomplete dropdown (triggers fly-to). */
  onSelect: (place: GeocodedPlace | null) => void;
  /** Called for clearing / external value changes (no fly-to). */
  onSelectFromMap?: (place: GeocodedPlace | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!value) {
      if (!isFocused) setQuery("");
    } else if (!isFocused) {
      const short = value.label.split(",").slice(0, 2).join(",").trim();
      setQuery(short);
    }
  }, [value, isFocused]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.trim().length < 2) {
      setSuggestions([]);
      setShowDropdown(false);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocode(val);
        setSuggestions(results);
        setShowDropdown(results.length > 0);
      } catch {
        setSuggestions([]);
      }
    }, 150);
  }, []);

  const handleSelect = useCallback(
    (place: GeocodedPlace) => {
      onSelect(place);
      const short = place.label.split(",").slice(0, 2).join(",").trim();
      setQuery(short);
      setShowDropdown(false);
    },
    [onSelect],
  );

  const handleClear = useCallback(() => {
    setQuery("");
    // Use onSelectFromMap (no fly-to) for clears; fall back to onSelect
    (onSelectFromMap ?? onSelect)(null);
    setSuggestions([]);
    setShowDropdown(false);
  }, [onSelect, onSelectFromMap]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 h-10 px-3 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-secondary)] bg-transparent outline-none"
        />
        {query && (
          <button
            onClick={handleClear}
            className="shrink-0 w-8 h-8 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#5f6368" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-[var(--shadow-lg)] z-50 overflow-hidden border border-[var(--color-border)]">
          {suggestions.map((s, i) => {
            const parts = s.label.split(",");
            const primary = parts[0]?.trim() || s.label;
            const secondary = parts.slice(1).join(",").trim();
            return (
              <button
                key={`${s.lat}-${s.lng}-${i}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                className="w-full text-left px-4 py-2.5 hover:bg-[var(--color-surface-hover)] transition-colors flex items-start gap-3"
              >
                <svg className="shrink-0 mt-0.5" width="16" height="16" viewBox="0 0 24 24" fill="#5f6368">
                  <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                </svg>
                <div className="min-w-0">
                  <div className="text-[13px] text-[var(--color-fg)] truncate">{primary}</div>
                  {secondary && <div className="text-[11px] text-[var(--color-secondary)] truncate">{secondary}</div>}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Leg color + label helpers
// ---------------------------------------------------------------------------

function legColor(leg: RouteLeg, routeMode: string): string {
  if (leg.mode === "lrt") return leg.transit_color ? `#${leg.transit_color}` : "#7b1fa2";
  if (leg.mode === "bus") return leg.transit_color ? `#${leg.transit_color}` : "#0b8043";
  if (leg.mode === "wait") return "#d0d0d0";
  if (leg.mode === "bike" && (routeMode === "bikeshare" || routeMode === "transit_bike")) return "#1a73e8";
  if (leg.mode === "bike") return "#34a853";
  return "#646464"; // walk
}

function legLabel(leg: RouteLeg): string {
  if (leg.mode === "lrt") return leg.transit_route || "LRT";
  if (leg.mode === "bus") return leg.transit_route || "Bus";
  if (leg.mode === "wait") return "Wait";
  if (leg.mode === "bike") return "Bike";
  return "Walk";
}

function legIcon(leg: RouteLeg): string {
  if (leg.mode === "lrt") return "🚈";
  if (leg.mode === "bus") return "🚍";
  if (leg.mode === "bike") return "🚲";
  if (leg.mode === "walk") return "🚶";
  return "⏱";
}

// ---------------------------------------------------------------------------
// RouteCard
// ---------------------------------------------------------------------------

function RouteCard({
  route,
  isSelected,
  onClick,
}: {
  route: RouteOption;
  isSelected: boolean;
  onClick: () => void;
}) {
  const cfg = MODE_CONFIG[route.mode] || MODE_CONFIG.walk;
  const duration = fmtDuration(route.total_duration_s);
  const distance = fmtDistance(route.total_distance_m);
  const hasTransit = route.legs.some((l) => l.mode === "lrt" || l.mode === "bus");

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-4 py-3 border-b border-[var(--color-border)] last:border-b-0 transition-colors ${
        isSelected
          ? "bg-[#e8f0fe] border-l-[3px] border-l-[var(--color-blue)]"
          : "hover:bg-[var(--color-surface-hover)] border-l-[3px] border-l-transparent"
      }`}
    >
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-[16px]">{cfg.icon}</span>
          <span className="text-[13px] font-medium" style={{ color: cfg.color }}>
            {cfg.label}
          </span>
        </div>
        <div className="text-right">
          <span className="text-[15px] font-medium text-[var(--color-fg)]">{duration}</span>
          {/* Show departure → arrival time for transit routes */}
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
          <span>· {fmtDistance(route.walk_distance_m)} walking</span>
        )}
        {route.total_ascent_m != null && (
          <span className="ml-auto flex items-center gap-1.5 text-[11px]">
            <span className="flex items-center gap-0.5">
              <svg width="8" height="8" viewBox="0 0 10 10"><path d="M5 1L9 9H1Z" fill="#34a853" /></svg>
              {Math.round(route.total_ascent_m)}m
            </span>
            <span className="flex items-center gap-0.5">
              <svg width="8" height="8" viewBox="0 0 10 10"><path d="M5 9L9 1H1Z" fill="#ea4335" /></svg>
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

      {/* Transit details (bus/LRT legs) */}
      {hasTransit && (
        <div className="mt-2 space-y-1">
          {route.legs.map((leg, i) => {
            if (leg.mode === "lrt" || leg.mode === "bus") {
              const color = leg.transit_color ? `#${leg.transit_color}` : (leg.mode === "bus" ? "#0b8043" : "#7b1fa2");
              return (
                <div
                  key={i}
                  className="flex items-center gap-2 text-[11px]"
                >
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
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9e9e9e" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 6v6l4 2" />
                  </svg>
                  Wait until {leg.wait_until} ({fmtDuration(leg.duration_s)})
                </div>
              );
            }
            return null;
          })}
          {/* Headsign / direction info */}
          {route.legs.filter((l) => l.mode === "lrt" || l.mode === "bus").map((l, i) => (
            l.transit_headsign && (
              <div key={`hs-${i}`} className="text-[10px] text-[var(--color-secondary)]">
                towards {l.transit_headsign}
              </div>
            )
          ))}
        </div>
      )}

      {/* Bike share station info */}
      {route.pickup_station && route.dropoff_station && (
        <div className="mt-1.5 text-[11px] text-[var(--color-secondary)]">
          🚲 {route.pickup_station.name} → {route.dropoff_station.name}
        </div>
      )}
      {route.pickup_station && !route.dropoff_station && (
        <div className="mt-1.5 text-[11px] text-[var(--color-secondary)]">
          🚲 from {route.pickup_station.name}
        </div>
      )}
      {!route.pickup_station && route.dropoff_station && (
        <div className="mt-1.5 text-[11px] text-[var(--color-secondary)]">
          🚲 to {route.dropoff_station.name}
        </div>
      )}

      {/* Elevation profile chart — only for the selected route */}
      {isSelected && route.elevation_profile && route.elevation_profile.length >= 2 && (
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
