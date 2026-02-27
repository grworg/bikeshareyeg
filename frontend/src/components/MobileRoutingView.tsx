"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import {
  Search, ArrowLeft, X, MapPin, Navigation, Clock,
  Check,
} from "lucide-react";
import { useAppStore } from "@/lib/appStore";
import type { RouteModeToggle } from "@/lib/appStore";
import type { GeocodedPlace } from "@/lib/types";
import { fmtDuration, fmtDistance } from "@/lib/types";
import { geocode, reverseGeocode } from "@/lib/api";
import { MODE_CONFIG } from "@/lib/constants";
import { shortLabel, MODE_TOGGLE_CONFIG } from "@/lib/routeHelpers";
import RouteCard from "@/components/RouteCard";

type Phase = "bar" | "search" | "results" | "viewing";

export default function MobileRoutingView() {
  const origin = useAppStore((s) => s.origin);
  const destination = useAppStore((s) => s.destination);
  const routes = useAppStore((s) => s.routes);
  const routeNotices = useAppStore((s) => s.routeNotices);
  const selectedRouteIndex = useAppStore((s) => s.selectedRouteIndex);
  const isLoadingRoutes = useAppStore((s) => s.isLoadingRoutes);
  const departureTime = useAppStore((s) => s.departureTime);
  const routeModeToggles = useAppStore((s) => s.routeModeToggles);

  const [phase, setPhase] = useState<Phase>(() => {
    if (selectedRouteIndex !== null && routes.length > 0) return "viewing";
    if (routes.length > 0) return "results";
    return "bar";
  });

  // Track which field to focus when search opens
  const [focusField, setFocusField] = useState<"dest" | "origin">("dest");

  // Auto-set GPS origin on first mount
  const gpsAttempted = useRef(false);
  useEffect(() => {
    if (gpsAttempted.current || origin) return;
    gpsAttempted.current = true;
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        if (useAppStore.getState().origin) return;
        try {
          const place = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          useAppStore.getState().setOrigin({ ...place, label: `${place.label}` });
        } catch {
          useAppStore.getState().setOrigin({
            label: "Your location",
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        }
      },
      () => {},
      { enableHighAccuracy: false, timeout: 5000 },
    );
  }, [origin]);

  // Auto-advance: when routes arrive, show results
  const prevRoutesLen = useRef(routes.length);
  useEffect(() => {
    if (routes.length > 0 && prevRoutesLen.current === 0) {
      setPhase("results");
    }
    prevRoutesLen.current = routes.length;
  }, [routes.length]);

  // When loading starts from search, move to results (spinner)
  useEffect(() => {
    if (isLoadingRoutes && phase === "search") setPhase("results");
  }, [isLoadingRoutes, phase]);

  // When user taps map while in "bar", open search
  const prevOrigin = useRef(origin);
  const prevDest = useRef(destination);
  useEffect(() => {
    const oChanged = origin !== prevOrigin.current;
    const dChanged = destination !== prevDest.current;
    prevOrigin.current = origin;
    prevDest.current = destination;
    if (phase === "bar" && (oChanged || dChanged) && (origin || destination)) {
      setFocusField(origin && !destination ? "dest" : "origin");
      setPhase("search");
    }
  }, [origin, destination, phase]);

  const handleSelectRoute = useCallback((idx: number) => {
    useAppStore.getState().setSelectedRouteIndex(idx);
    setPhase("viewing");
  }, []);

  const handleOpenSearch = useCallback((field: "dest" | "origin" = "dest") => {
    setFocusField(field);
    setPhase("search");
  }, []);

  const handleBack = useCallback(() => {
    if (phase === "results") setPhase("search");
    else if (phase === "viewing") setPhase("results");
    else setPhase("bar");
  }, [phase]);

  // ---- Bar phase ----
  if (phase === "bar") {
    return (
      <button
        onClick={() => handleOpenSearch("dest")}
        className="absolute top-3 left-3 right-14 z-30 flex items-center gap-3 bg-[var(--color-surface)] rounded-full px-4 h-12 shadow-[var(--shadow-md)] active:shadow-[var(--shadow-sm)] transition-shadow"
      >
        <Search size={18} className="text-[var(--color-secondary)] shrink-0" />
        <span className="flex-1 text-left text-[14px] text-[var(--color-secondary)] truncate">
          {destination ? shortLabel(destination.label) : "Where to?"}
        </span>
      </button>
    );
  }

  // ---- Search phase ----
  if (phase === "search") {
    return (
      <MobileSearchPanel
        focusField={focusField}
        onBack={handleBack}
        onSetFocusField={setFocusField}
      />
    );
  }

  // ---- Results phase ----
  if (phase === "results") {
    return (
      <div className="absolute inset-0 z-50 bg-[var(--color-surface)] flex flex-col">
        <div className="flex items-center gap-2 px-2 pt-safe shrink-0 border-b border-[var(--color-border)]">
          <button
            onClick={handleBack}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
          >
            <ArrowLeft size={20} className="text-[var(--color-fg)]" />
          </button>
          <div className="flex-1 min-w-0">
            {origin && destination ? (
              <div className="flex items-center gap-1.5 text-[13px] text-[var(--color-fg)] truncate">
                <span className="truncate max-w-[40%]">{shortLabel(origin.label)}</span>
                <span className="text-[var(--color-secondary)]">→</span>
                <span className="truncate max-w-[40%]">{shortLabel(destination.label)}</span>
              </div>
            ) : (
              <span className="text-[14px] text-[var(--color-fg)]">Routes</span>
            )}
          </div>
          <button
            onClick={() => handleOpenSearch("dest")}
            className="text-[12px] text-[var(--color-blue)] font-medium px-3 py-1.5 rounded-full hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
          >
            Edit
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {isLoadingRoutes ? (
            <div className="px-4 py-10 text-center">
              <div className="inline-block w-6 h-6 border-2 border-[var(--color-blue)] border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-[var(--color-secondary)] mt-3">Computing routes...</p>
            </div>
          ) : routes.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-[14px] text-[var(--color-fg)] font-medium">No routes found</p>
              <p className="text-[12px] text-[var(--color-secondary)] mt-1">Try adjusting your mode filters or locations</p>
              <button
                onClick={() => handleOpenSearch("dest")}
                className="mt-4 px-5 py-2 rounded-full bg-[var(--color-blue)] text-white text-[13px] font-medium"
              >
                Edit search
              </button>
            </div>
          ) : (
            <>
              {routeNotices.length > 0 && (
                <div className="px-4 py-2 bg-amber-50 border-b border-amber-200">
                  {routeNotices.map((n, i) => (
                    <p key={i} className="text-[12px] text-amber-700">{n}</p>
                  ))}
                </div>
              )}
              {routes.map((route, i) => (
                <RouteCard
                  key={`${route.mode}-${i}`}
                  route={route}
                  isSelected={false}
                  onClick={() => handleSelectRoute(i)}
                  compact
                />
              ))}
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Viewing phase ----
  const selectedRoute = selectedRouteIndex !== null ? routes[selectedRouteIndex] : null;
  if (phase === "viewing" && selectedRoute) {
    const cfg = MODE_CONFIG[selectedRoute.mode] || MODE_CONFIG.walk;
    return (
      <div className="absolute top-3 left-3 right-14 z-30 bg-[var(--color-surface)] rounded-2xl shadow-[var(--shadow-md)] overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3">
          <button onClick={() => setPhase("results")} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors shrink-0">
            <ArrowLeft size={18} className="text-[var(--color-fg)]" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span style={{ color: cfg.color }}>{cfg.icon}</span>
              <span className="text-[14px] font-semibold text-[var(--color-fg)]">{fmtDuration(selectedRoute.total_duration_s)}</span>
              <span className="text-[12px] text-[var(--color-secondary)]">· {fmtDistance(selectedRoute.total_distance_m)}</span>
            </div>
            <div className="text-[11px] text-[var(--color-secondary)] truncate mt-0.5">
              {shortLabel(origin?.label ?? "")} → {shortLabel(destination?.label ?? "")}
            </div>
          </div>
          <button
            onClick={() => {
              useAppStore.getState().clearRoutes();
              useAppStore.getState().setOrigin(null);
              useAppStore.getState().setDestination(null);
              setPhase("bar");
            }}
            className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors shrink-0"
          >
            <X size={16} className="text-[var(--color-secondary)]" />
          </button>
        </div>
      </div>
    );
  }

  // Fallback
  return (
    <button
      onClick={() => handleOpenSearch("dest")}
      className="absolute top-3 left-3 right-14 z-30 flex items-center gap-3 bg-[var(--color-surface)] rounded-full px-4 h-12 shadow-[var(--shadow-md)]"
    >
      <Search size={18} className="text-[var(--color-secondary)]" />
      <span className="text-[14px] text-[var(--color-secondary)]">Where to?</span>
    </button>
  );
}

// ===========================================================================
// MobileSearchPanel — destination-first, GPS origin, inline autocomplete
// ===========================================================================

function MobileSearchPanel({
  focusField,
  onBack,
  onSetFocusField,
}: {
  focusField: "dest" | "origin";
  onBack: () => void;
  onSetFocusField: (f: "dest" | "origin") => void;
}) {
  const origin = useAppStore((s) => s.origin);
  const destination = useAppStore((s) => s.destination);
  const departureTime = useAppStore((s) => s.departureTime);
  const routeModeToggles = useAppStore((s) => s.routeModeToggles);

  const destInputRef = useRef<HTMLInputElement>(null);
  const originInputRef = useRef<HTMLInputElement>(null);

  const [destQuery, setDestQuery] = useState(destination ? shortLabel(destination.label) : "");
  const [originQuery, setOriginQuery] = useState(origin ? shortLabel(origin.label) : "");
  const [suggestions, setSuggestions] = useState<GeocodedPlace[]>([]);
  const [activeField, setActiveField] = useState<"dest" | "origin">(focusField);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-focus the correct field on mount
  useEffect(() => {
    requestAnimationFrame(() => {
      if (focusField === "dest") destInputRef.current?.focus();
      else originInputRef.current?.focus();
    });
  }, [focusField]);

  // Sync external origin/dest changes into local query strings
  useEffect(() => {
    if (origin && activeField !== "origin") setOriginQuery(shortLabel(origin.label));
  }, [origin, activeField]);
  useEffect(() => {
    if (destination && activeField !== "dest") setDestQuery(shortLabel(destination.label));
  }, [destination, activeField]);

  const handleQueryChange = useCallback((val: string, field: "dest" | "origin") => {
    if (field === "dest") setDestQuery(val);
    else setOriginQuery(val);
    setActiveField(field);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (val.length < 2) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const results = await geocode(val);
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    }, 150);
  }, []);

  const handleSelectSuggestion = useCallback((place: GeocodedPlace) => {
    const short = shortLabel(place.label);
    if (activeField === "dest") {
      setDestQuery(short);
      useAppStore.getState().setDestination(place);
      // If origin is set, auto-search
      if (useAppStore.getState().origin) {
        useAppStore.getState().getDirections();
      }
    } else {
      setOriginQuery(short);
      useAppStore.getState().setOrigin(place);
    }
    setSuggestions([]);
    useAppStore.getState().setFlyTo({ latitude: place.lat, longitude: place.lng, zoom: 14, _ts: Date.now() });
  }, [activeField]);

  const handleClear = useCallback((field: "dest" | "origin") => {
    if (field === "dest") {
      setDestQuery("");
      useAppStore.getState().setDestination(null);
    } else {
      setOriginQuery("");
      useAppStore.getState().setOrigin(null);
    }
    setSuggestions([]);
    setActiveField(field);
    requestAnimationFrame(() => {
      if (field === "dest") destInputRef.current?.focus();
      else originInputRef.current?.focus();
    });
  }, []);

  const canSearch = !!origin && !!destination;

  return (
    <div className="absolute inset-0 z-50 bg-[var(--color-surface)] flex flex-col">
      {/* Header with inputs */}
      <div className="shrink-0 pt-safe">
        <div className="flex items-start gap-1 px-2 py-2">
          <button
            onClick={onBack}
            className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-[var(--color-surface-hover)] transition-colors shrink-0 mt-0.5"
          >
            <ArrowLeft size={20} className="text-[var(--color-fg)]" />
          </button>

          <div className="flex-1 flex flex-col gap-1">
            {/* Origin */}
            <div className="flex items-center bg-[var(--color-surface-alt,#f1f3f4)] rounded-lg">
              <span className="pl-3 pr-1.5">
                <Navigation size={14} className="text-[var(--color-blue)]" />
              </span>
              <input
                ref={originInputRef}
                type="text"
                value={originQuery}
                onChange={(e) => handleQueryChange(e.target.value, "origin")}
                onFocus={() => { setActiveField("origin"); onSetFocusField("origin"); }}
                placeholder="Your location"
                className="flex-1 h-10 px-1.5 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-secondary)] bg-transparent outline-none"
              />
              {originQuery && (
                <button onClick={() => handleClear("origin")} className="w-9 h-9 flex items-center justify-center shrink-0">
                  <X size={14} className="text-[var(--color-secondary)]" />
                </button>
              )}
            </div>

            {/* Destination */}
            <div className={`flex items-center rounded-lg ${
              activeField === "dest" ? "bg-[var(--color-surface)] ring-2 ring-[var(--color-blue)] shadow-sm" : "bg-[var(--color-surface-alt,#f1f3f4)]"
            }`}>
              <span className="pl-3 pr-1.5">
                <MapPin size={14} className="text-[var(--color-red,#ea4335)]" />
              </span>
              <input
                ref={destInputRef}
                type="text"
                value={destQuery}
                onChange={(e) => handleQueryChange(e.target.value, "dest")}
                onFocus={() => { setActiveField("dest"); onSetFocusField("dest"); }}
                placeholder="Search a destination"
                className="flex-1 h-10 px-1.5 text-[14px] text-[var(--color-fg)] placeholder:text-[var(--color-secondary)] bg-transparent outline-none"
              />
              {destQuery && (
                <button onClick={() => handleClear("dest")} className="w-9 h-9 flex items-center justify-center shrink-0">
                  <X size={14} className="text-[var(--color-secondary)]" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Mode toggles */}
        <div className="flex items-center gap-1.5 px-4 pb-2 overflow-x-auto">
          {MODE_TOGGLE_CONFIG.map(({ key, label, icon }) => {
            const active = routeModeToggles[key];
            return (
              <button
                key={key}
                onClick={() => useAppStore.getState().setRouteModeToggle(key, !active)}
                className={`inline-flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full text-[12px] font-medium transition-all border whitespace-nowrap ${
                  active
                    ? "bg-[var(--color-fg)] text-white border-[var(--color-fg)]"
                    : "bg-[var(--color-surface)] text-[var(--color-secondary)] border-[var(--color-border)]"
                }`}
              >
                {active ? <Check size={12} strokeWidth={2.5} /> : icon}
                {label}
              </button>
            );
          })}
        </div>

        <div className="border-b border-[var(--color-border)]" />
      </div>

      {/* Suggestions / content */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {suggestions.length > 0 ? (
          suggestions.map((s, i) => {
            const parts = s.label.split(",");
            const primary = parts[0]?.trim() || s.label;
            const secondary = parts.slice(1).join(",").trim();
            return (
              <button
                key={`${s.lat}-${s.lng}-${i}`}
                onClick={() => handleSelectSuggestion(s)}
                className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-[var(--color-surface-hover)] active:bg-[var(--color-surface-hover)] transition-colors border-b border-[var(--color-border)] last:border-b-0"
              >
                <MapPin size={16} className="shrink-0 mt-0.5 text-[var(--color-secondary)]" />
                <div className="min-w-0">
                  <div className="text-[14px] text-[var(--color-fg)] truncate">{primary}</div>
                  {secondary && <div className="text-[12px] text-[var(--color-secondary)] truncate">{secondary}</div>}
                </div>
              </button>
            );
          })
        ) : (
          <div className="px-6 py-8 text-center">
            {canSearch ? (
              <button
                onClick={() => useAppStore.getState().getDirections()}
                className="w-full py-3 rounded-lg bg-[var(--color-blue)] text-white text-[14px] font-medium shadow-sm"
              >
                Get Directions
              </button>
            ) : (
              <p className="text-[13px] text-[var(--color-secondary)]">
                {activeField === "dest" ? "Search for a destination" : "Search for a starting point, or use GPS"}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

