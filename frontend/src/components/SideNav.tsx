"use client";

import type { AppMode } from "@/lib/types";

// ---------------------------------------------------------------------------
// Nav items configuration — single source of truth for both desktop + mobile
// ---------------------------------------------------------------------------

interface NavDef {
  mode: AppMode;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavDef[] = [
  {
    mode: "routing",
    label: "Trip Planner",
    shortLabel: "Routes",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="10" r="3" />
        <path d="M12 2a8 8 0 00-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 00-8-8z" />
      </svg>
    ),
  },
  {
    mode: "designer",
    label: "Network Designer",
    shortLabel: "Designer",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 2L2 7l10 5 10-5-10-5z" />
        <path d="M2 17l10 5 10-5" />
        <path d="M2 12l10 5 10-5" />
      </svg>
    ),
  },
  {
    mode: "saved",
    label: "Saved Networks",
    shortLabel: "Saved",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
      </svg>
    ),
  },
];

const DOCS_ITEM: NavDef = {
  mode: "docs",
  label: "Documentation",
  shortLabel: "Docs",
  icon: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
      <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
    </svg>
  ),
};

// ---------------------------------------------------------------------------
// Bike logo SVG — shared between desktop and mobile
// ---------------------------------------------------------------------------

function BikeLogo({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5.5" cy="17" r="3.5" />
      <circle cx="18.5" cy="17" r="3.5" />
      <path d="M15 6a1 1 0 100-2 1 1 0 000 2z" fill="#1a73e8" stroke="none" />
      <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Desktop SideNav — 48px rail that expands to 200px on hover
// ---------------------------------------------------------------------------

interface SideNavProps {
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
}

export default function SideNav({ mode, onChangeMode }: SideNavProps) {
  const allItems = [...NAV_ITEMS, DOCS_ITEM];

  return (
    <nav className="group/nav w-12 hover:w-[200px] shrink-0 z-40 bg-white shadow-[1px_0_4px_rgba(0,0,0,0.08)] transition-[width] duration-200 ease-out flex flex-col py-2 overflow-hidden">
      {/* Logo + brand */}
      <div className="flex items-center gap-3 px-1.5 h-10 mb-2 shrink-0">
        <div className="w-9 h-9 shrink-0 rounded-full bg-[#e8f0fe] flex items-center justify-center">
          <BikeLogo />
        </div>
        <span className="text-[13px] font-semibold text-[var(--color-fg)] whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
          BikeShareYEG
        </span>
      </div>

      {/* All nav items inline */}
      {allItems.map((item) => (
        <DesktopNavItem
          key={item.mode}
          item={item}
          active={mode === item.mode}
          onClick={() => onChangeMode(item.mode)}
        />
      ))}
    </nav>
  );
}

function DesktopNavItem({
  item,
  active,
  onClick,
}: {
  item: NavDef;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={item.label}
      className={`flex items-center gap-3 mx-1 px-1 h-10 rounded-lg transition-colors shrink-0 overflow-hidden ${
        active
          ? "bg-[#e8f0fe] text-[#1a73e8]"
          : "text-[#5f6368] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      <div className="w-9 h-9 shrink-0 flex items-center justify-center">
        {item.icon}
      </div>
      <span className="text-[13px] font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
        {item.label}
      </span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Mobile tab bar — fixed at bottom of screen
// ---------------------------------------------------------------------------

interface MobileTabBarProps {
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
}

export function MobileTabBar({ mode, onChangeMode }: MobileTabBarProps) {
  const allItems = [...NAV_ITEMS, DOCS_ITEM];

  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[var(--color-border)] flex items-stretch z-50 pb-safe">
      {allItems.map((item) => {
        const active = mode === item.mode;
        return (
          <button
            key={item.mode}
            onClick={() => onChangeMode(item.mode)}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
              active ? "text-[#1a73e8]" : "text-[#5f6368]"
            }`}
          >
            <span className="[&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
            <span className="text-[10px] font-medium">{item.shortLabel}</span>
          </button>
        );
      })}
    </nav>
  );
}
