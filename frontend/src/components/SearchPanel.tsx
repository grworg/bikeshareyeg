"use client";

import {
  useState,
  useRef,
  useEffect,
  useCallback,
  type ChangeEvent,
} from "react";
import { Clock, X, MapPin as MapPinIcon, Check } from "lucide-react";
import type { GeocodedPlace, RouteOption } from "@/lib/types";
import { geocode } from "@/lib/api";
import type { RouteModeToggle } from "@/lib/appStore";
import { MODE_TOGGLE_CONFIG } from "@/lib/routeHelpers";
import RouteCard from "@/components/RouteCard";

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
  routeModeToggles: Record<RouteModeToggle, boolean>;
  onToggleRouteMode: (key: RouteModeToggle, on: boolean) => void;
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
  routeModeToggles,
  onToggleRouteMode,
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
        <DepartureTimePicker value={departureTime} onChange={onSetDepartureTime} />

        {/* Mode toggles */}
        <ModeToggles toggles={routeModeToggles} onToggle={onToggleRouteMode} />

        {/* Get Directions button */}
        {showGetDirections && (
          <div className="px-4 pb-3 -mt-0.5">
            <button
              onClick={onGetDirections}
              className="w-full py-2.5 rounded-lg bg-[var(--color-blue)] text-white text-[14px] font-medium hover:bg-[var(--color-blue-hover)] active:bg-[var(--color-blue-hover)] transition-colors shadow-sm"
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
// Departure time picker — "Depart now" chip that expands into date/time inputs
// ---------------------------------------------------------------------------

function localISOString(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDepartLabel(iso: string): string {
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday =
      d.getFullYear() === now.getFullYear() &&
      d.getMonth() === now.getMonth() &&
      d.getDate() === now.getDate();
    const time = d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    if (isToday) return `Today at ${time}`;
    const date = d.toLocaleDateString([], { month: "short", day: "numeric" });
    return `${date} at ${time}`;
  } catch {
    return iso;
  }
}

function DepartureTimePicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (val: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChipClick = () => {
    if (!open) {
      if (!value) onChange(localISOString(new Date()));
      setOpen(true);
    } else {
      setOpen(false);
    }
  };

  return (
    <div ref={wrapperRef} className="px-4 pb-2.5 -mt-0.5">
      <div className="flex items-center gap-2">
        <button
          onClick={handleChipClick}
          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-[12px] font-medium transition-colors border ${
            value
              ? "bg-[var(--color-blue)]/8 border-[var(--color-blue)]/25 text-[var(--color-blue)]"
              : "bg-[var(--color-surface-alt)] border-[var(--color-border)] text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)]"
          }`}
        >
          <Clock size={13} />
          {value ? formatDepartLabel(value) : "Depart now"}
        </button>
        {value && (
          <button
            onClick={() => { onChange(null); setOpen(false); }}
            className="text-[11px] text-[var(--color-blue)] hover:underline font-medium"
          >
            Reset
          </button>
        )}
      </div>
      {open && (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="datetime-local"
            value={value ?? ""}
            onChange={(e) => onChange(e.target.value || null)}
            className="text-[12px] text-[var(--color-fg)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 outline-none focus:border-[var(--color-blue)] focus:ring-1 focus:ring-[var(--color-blue)]/20 transition-all shadow-sm"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Mode toggles — pill-style checkboxes for transport modes
// ---------------------------------------------------------------------------

function ModeToggles({
  toggles,
  onToggle,
}: {
  toggles: Record<RouteModeToggle, boolean>;
  onToggle: (key: RouteModeToggle, on: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 px-4 pb-3 flex-wrap">
      {MODE_TOGGLE_CONFIG.map(({ key, label, icon }) => {
        const active = toggles[key];
        return (
          <button
            key={key}
            onClick={() => onToggle(key, !active)}
            className={`inline-flex items-center gap-1.5 pl-2.5 pr-3 py-2 rounded-full text-[12px] font-medium transition-all border ${
              active
                ? "bg-[var(--color-fg)] text-white border-[var(--color-fg)] shadow-sm"
                : "bg-[var(--color-surface)] text-[var(--color-secondary)] border-[var(--color-border)] hover:bg-[var(--color-surface-hover)]"
            }`}
          >
            {active ? <Check size={12} strokeWidth={2.5} /> : icon}
            {label}
          </button>
        );
      })}
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
  const [highlightIdx, setHighlightIdx] = useState(-1);
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
        setHighlightIdx(results.length > 0 ? 0 : -1);
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
    (onSelectFromMap ?? onSelect)(null);
    setSuggestions([]);
    setShowDropdown(false);
  }, [onSelect, onSelectFromMap]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!showDropdown || suggestions.length === 0) return;
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightIdx((i) => (i + 1) % suggestions.length);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightIdx((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const idx = highlightIdx >= 0 ? highlightIdx : 0;
        if (suggestions[idx]) handleSelect(suggestions[idx]);
      } else if (e.key === "Escape") {
        setShowDropdown(false);
      }
    },
    [showDropdown, suggestions, highlightIdx, handleSelect],
  );

  return (
    <div ref={wrapperRef} className="relative">
      <div className="flex items-center">
        <input
          type="text"
          value={query}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            setIsFocused(true);
            if (suggestions.length > 0) setShowDropdown(true);
          }}
          onBlur={() => setIsFocused(false)}
          placeholder={placeholder}
          className="flex-1 h-11 px-3 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-secondary)] bg-transparent outline-none"
        />
        {query && (
          <button
            onClick={handleClear}
            className="shrink-0 w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors"
          >
            <X size={14} className="text-[var(--color-secondary)]" />
          </button>
        )}
      </div>

      {showDropdown && suggestions.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-lg)] z-50 overflow-hidden border border-[var(--color-border)]">
          {suggestions.map((s, i) => {
            const parts = s.label.split(",");
            const primary = parts[0]?.trim() || s.label;
            const secondary = parts.slice(1).join(",").trim();
            return (
              <button
                key={`${s.lat}-${s.lng}-${i}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(s)}
                onMouseEnter={() => setHighlightIdx(i)}
                className={`w-full text-left px-4 py-3 transition-colors flex items-start gap-3 ${
                  i === highlightIdx ? "bg-[var(--color-surface-hover)]" : "hover:bg-[var(--color-surface-hover)]"
                }`}
              >
                <MapPinIcon size={16} className="shrink-0 mt-0.5 text-[var(--color-secondary)]" />
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

