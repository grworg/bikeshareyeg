"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const PEEK_FRACTION = 0.42;
const FULL_FRACTION = 0.88;
const DISMISS_THRESHOLD = 80;
const VELOCITY_DISMISS = 0.4;

export default function MobileSidebar({ open, onClose, children }: MobileSidebarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragOffsetRef = useRef(0);

  const getContainerH = useCallback(() => containerRef.current?.clientHeight ?? 600, []);
  const peekH = useCallback(() => Math.round(getContainerH() * PEEK_FRACTION), [getContainerH]);
  const fullH = useCallback(() => Math.round(getContainerH() * FULL_FRACTION), [getContainerH]);

  useEffect(() => {
    if (open) {
      setSheetHeight(fullH());
      dragOffsetRef.current = 0;
    } else {
      setSheetHeight(0);
    }
  }, [open, fullH]);

  const touchStart = useRef<{ y: number; h: number; t: number } | null>(null);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!open) return;
      touchStart.current = {
        y: e.touches[0].clientY,
        h: sheetHeight,
        t: Date.now(),
      };
      setDragging(true);
    },
    [open, sheetHeight],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStart.current) return;
      const dy = touchStart.current.y - e.touches[0].clientY;
      const maxH = fullH();
      const newH = Math.max(0, Math.min(maxH, touchStart.current.h + dy));
      setSheetHeight(newH);
      dragOffsetRef.current = dy;
    },
    [fullH],
  );

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current) return;
    const elapsed = Date.now() - touchStart.current.t;
    const velocity = dragOffsetRef.current / Math.max(elapsed, 1);
    const h = sheetHeight;
    const pk = peekH();
    const fl = fullH();
    setDragging(false);
    touchStart.current = null;
    dragOffsetRef.current = 0;

    if (velocity < -VELOCITY_DISMISS) {
      setSheetHeight(0);
      onClose();
      return;
    }
    if (velocity > VELOCITY_DISMISS) {
      setSheetHeight(fl);
      return;
    }
    if (h < DISMISS_THRESHOLD) {
      setSheetHeight(0);
      onClose();
    } else if (h < (pk + fl) / 2) {
      setSheetHeight(pk);
    } else {
      setSheetHeight(fl);
    }
  }, [sheetHeight, onClose, peekH, fullH]);

  const noTransition =
    dragging ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none z-40">
      {open || sheetHeight > 0 ? (
        <div
          className="absolute left-0 right-0 bottom-0 flex flex-col bg-[var(--color-surface)] rounded-t-2xl shadow-[var(--shadow-lg)] pointer-events-auto"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            height: sheetHeight,
            transition: noTransition ? "none" : "height 250ms cubic-bezier(0.32, 0.72, 0, 1)",
          }}
        >
          {/* Drag handle */}
          <div
            className="shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
            style={{ height: 28, touchAction: "none" }}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            <div className="w-8 h-1 rounded-full bg-[var(--color-border)]" />
          </div>

          {/* Scrollable content */}
          <div
            ref={contentRef}
            className="flex-1 overflow-y-auto min-h-0 overscroll-contain"
          >
            {children}
          </div>
        </div>
      ) : null}
    </div>
  );
}
