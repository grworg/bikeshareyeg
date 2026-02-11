"use client";

import { useEffect } from "react";

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

/**
 * Slide-up panel for mobile. Sits above the MobileTabBar (bottom-14).
 * Shows sidebar content in a scrollable container.
 */
export default function MobileSidebar({ open, onClose, children }: MobileSidebarProps) {
  // Lock body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [open]);

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 bg-black/30 z-40 transition-opacity duration-300 ${
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
        onClick={onClose}
      />

      {/* Sheet */}
      <div
        className={`fixed left-0 right-0 bottom-14 z-40 bg-white rounded-t-2xl shadow-2xl
          transition-transform duration-300 ease-out flex flex-col
          ${open ? "translate-y-0" : "translate-y-full"}`}
        style={{ maxHeight: "75vh" }}
      >
        {/* Drag handle (visual) */}
        <div className="flex justify-center py-2 shrink-0">
          <div className="w-8 h-1 rounded-full bg-gray-300" />
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {children}
        </div>
      </div>
    </>
  );
}
