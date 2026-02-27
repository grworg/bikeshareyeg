"use client";

import { useCallback, useEffect, useRef } from "react";
import { CirclePlus } from "lucide-react";

export interface ContextMenuState {
  x: number;
  y: number;
  lng: number;
  lat: number;
}

interface ContextMenuProps {
  menu: ContextMenuState;
  onAddStation: (lngLat: { lng: number; lat: number }) => void;
  onClose: () => void;
}

export default function ContextMenu({ menu, onAddStation, onClose }: ContextMenuProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  // Stable close handler to avoid re-registering listeners on every parent render
  const stableClose = useCallback(() => onCloseRef.current(), []);

  // Close on click-outside or Escape.
  // Use a short mount delay to avoid the right-click's own mouseup / synthetic
  // events from immediately closing the menu.
  useEffect(() => {
    let armed = false;
    const armTimer = setTimeout(() => { armed = true; }, 120);

    function handleClick(e: MouseEvent) {
      if (!armed) return;
      if (ref.current && !ref.current.contains(e.target as Node)) stableClose();
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") stableClose();
    }
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      clearTimeout(armTimer);
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [stableClose]);

  // Keep menu within viewport
  const style: React.CSSProperties = {
    position: "fixed",
    left: menu.x,
    top: menu.y,
    zIndex: 100,
  };

  return (
    <div ref={ref} style={style}>
      <div className="bg-[var(--color-surface)] rounded-lg shadow-[var(--shadow-lg)] border border-[var(--color-border)] py-1 min-w-[200px] overflow-hidden">
        <button
          onClick={() => {
            onAddStation({ lng: menu.lng, lat: menu.lat });
            onClose();
          }}
          className="w-full text-left px-4 py-2.5 text-[13px] text-[var(--color-fg)] hover:bg-[var(--color-surface-hover)] transition-colors flex items-center gap-3"
        >
          <CirclePlus size={16} className="text-[var(--color-secondary)]" />
          Add station here
        </button>
        <div className="mx-3 my-0.5 border-t border-[var(--color-border)]" />
        <div className="px-4 py-1.5 text-[11px] text-[var(--color-secondary)] tabular-nums">
          {menu.lat.toFixed(5)}, {menu.lng.toFixed(5)}
        </div>
      </div>
    </div>
  );
}
