"use client";

import { useCallback, useRef, useState, useEffect } from "react";

interface MobileInfoCardProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

const DISMISS_THRESHOLD = 60;
const VELOCITY_DISMISS = 0.3;

export default function MobileInfoCard({ open, onClose, children }: MobileInfoCardProps) {
  const [visible, setVisible] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState(0);
  const touchStart = useRef<{ y: number; t: number } | null>(null);

  useEffect(() => {
    if (open) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStart.current = { y: e.touches[0].clientY, t: Date.now() };
    setDragging(true);
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStart.current) return;
    const dy = e.touches[0].clientY - touchStart.current.y;
    setDragOffset(Math.max(0, dy));
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (!touchStart.current) return;
    const elapsed = Date.now() - touchStart.current.t;
    const velocity = dragOffset / Math.max(elapsed, 1);
    setDragging(false);
    touchStart.current = null;

    if (velocity > VELOCITY_DISMISS || dragOffset > DISMISS_THRESHOLD) {
      setVisible(false);
      setTimeout(onClose, 200);
    }
    setDragOffset(0);
  }, [dragOffset, onClose]);

  if (!open) return null;

  const noTransition =
    dragging ||
    (typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches);

  return (
    <div className="absolute inset-0 pointer-events-none z-50">
      <div
        className="absolute left-2 right-2 bottom-2 rounded-2xl bg-[var(--color-surface)] shadow-[var(--shadow-lg)] pointer-events-auto max-h-[40vh] flex flex-col overflow-hidden"
        style={{
          transform: visible && dragOffset === 0
            ? "translateY(0)"
            : visible
              ? `translateY(${dragOffset}px)`
              : "translateY(100%)",
          transition: noTransition ? "none" : "transform 200ms cubic-bezier(0.32, 0.72, 0, 1)",
        }}
      >
        {/* Drag handle */}
        <div
          className="shrink-0 flex items-center justify-center cursor-grab active:cursor-grabbing select-none"
          style={{ height: 24, touchAction: "none" }}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className="w-8 h-1 rounded-full bg-[var(--color-border)]" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto min-h-0 overscroll-contain">
          {children}
        </div>
      </div>
    </div>
  );
}
