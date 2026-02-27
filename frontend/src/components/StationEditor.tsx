"use client";

import { useRef, useEffect } from "react";
import { X, Trash2 } from "lucide-react";
import type { BikeStation } from "@/lib/types";

interface StationEditorProps {
  station: BikeStation;
  autoFocusName: boolean;
  onUpdate: (updates: Partial<BikeStation>) => void;
  onCommit: () => void;
  onDelete: () => void;
  onDeselect: () => void;
}

export default function StationEditor({
  station,
  autoFocusName,
  onUpdate,
  onCommit,
  onDelete,
  onDeselect,
}: StationEditorProps) {
  const nameInputRef = useRef<HTMLInputElement>(null);
  const didAutoFocusRef = useRef<string | null>(null);

  useEffect(() => {
    if (autoFocusName && station.id !== didAutoFocusRef.current && nameInputRef.current) {
      didAutoFocusRef.current = station.id;
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [autoFocusName, station.id]);

  const pct = station.bikes / Math.max(station.capacity, 1);
  const fillCol = pct < 0.15 || pct > 0.85 ? "#ea4335" : pct < 0.3 || pct > 0.7 ? "#fbbc04" : "#34a853";

  return (
    <div className="border-b border-[var(--color-border)] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 bg-[var(--color-surface-alt)]">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] text-[var(--color-secondary)] uppercase tracking-wider">
            Editing Station
          </p>
          <input
            ref={nameInputRef}
            type="text"
            value={station.name}
            onChange={(e) => onUpdate({ name: e.target.value })}
            onBlur={onCommit}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
              if (e.key === "z" && (e.ctrlKey || e.metaKey)) e.stopPropagation();
            }}
            className="text-[14px] font-medium text-[var(--color-fg)] mt-0.5 w-full bg-transparent border-b border-transparent hover:border-[var(--color-border)] focus:border-[var(--color-blue)] focus:outline-none transition-colors py-0.5"
            placeholder="Station name"
          />
        </div>
        <button
          onClick={onDeselect}
          className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--color-surface-hover)] transition-colors ml-2"
          title="Deselect (Esc)"
        >
          <X size={14} className="text-[var(--color-secondary)]" />
        </button>
      </div>

      <div className="px-5 py-3 space-y-3">
        {/* Capacity */}
        <SliderField label="Dock capacity" value={station.capacity} min={2} max={60}
          onChange={(val) => onUpdate({ capacity: val, bikes: Math.min(station.bikes, val) })}
          onCommit={onCommit}
        />
        {/* Bikes */}
        <SliderField label="Current bikes" value={station.bikes} min={0} max={station.capacity}
          onChange={(val) => onUpdate({ bikes: val })}
          onCommit={onCommit}
          color={fillCol}
        />
        {/* Fill bar */}
        <div className="flex items-center gap-2 text-[12px] text-[var(--color-secondary)]">
          <div className="flex-1 h-2 rounded-full bg-[var(--color-border)] overflow-hidden">
            <div className="h-full rounded-full transition-all"
              style={{ width: `${pct * 100}%`, backgroundColor: fillCol }} />
          </div>
          <span>{station.bikes}/{station.capacity}</span>
        </div>
        {/* Coordinates */}
        <div className="text-[11px] text-[var(--color-secondary)] tabular-nums">
          {station.lat.toFixed(5)}, {station.lng.toFixed(5)}
        </div>
        {/* Delete */}
        <button onClick={onDelete}
          className="w-full h-8 text-[12px] font-medium rounded-full border border-[#ea433580] text-[var(--color-red)] hover:bg-red-50 transition-colors flex items-center justify-center gap-1.5">
          <Trash2 size={13} />
          Delete station
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Slider
// ---------------------------------------------------------------------------

function SliderField({
  label, value, min, max, onChange, onCommit, color = "var(--color-blue)",
}: {
  label: string; value: number; min: number; max: number;
  onChange: (v: number) => void; onCommit?: () => void; color?: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[12px] text-[var(--color-secondary)]">{label}</span>
        <span className="text-[13px] font-medium text-[var(--color-fg)] tabular-nums">{value}</span>
      </div>
      <input type="range" min={min} max={max} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={() => onCommit?.()}
        onKeyUp={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") onCommit?.(); }}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer"
        style={{
          background: `linear-gradient(to right, ${color} ${((value - min) / (max - min)) * 100}%, #e0e0e0 ${((value - min) / (max - min)) * 100}%)`,
          accentColor: color,
        }}
      />
    </div>
  );
}
