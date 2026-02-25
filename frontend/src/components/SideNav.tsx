"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppMode } from "@/lib/types";
import { useNetworkStore } from "@/lib/networkStore";

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
// Helpers
// ---------------------------------------------------------------------------

function hrefForMode(mode: AppMode, activeNetworkId: string | null): string {
  switch (mode) {
    case "routing": return "/routing";
    case "designer": return activeNetworkId ? `/designer/${activeNetworkId}` : "/designer";
    case "saved": return "/saved";
    case "docs": return "/docs";
  }
}

function modeFromPathname(pathname: string): AppMode {
  if (pathname.startsWith("/designer")) return "designer";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/docs")) return "docs";
  return "routing";
}

// ---------------------------------------------------------------------------
// Bike logo SVG
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

export default function SideNav() {
  const pathname = usePathname();
  const currentMode = modeFromPathname(pathname);
  const activeNetworkId = useNetworkStore((s) => s.activeNetworkId);

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

      {/* App mode nav items */}
      {NAV_ITEMS.map((item) => (
        <DesktopNavLink
          key={item.mode}
          item={item}
          href={hrefForMode(item.mode, activeNetworkId)}
          active={currentMode === item.mode}
        />
      ))}

      {/* Docs */}
      <Link
        href="/docs"
        title={DOCS_ITEM.label}
        className="flex items-center gap-3 mx-1 px-1 h-10 rounded-lg transition-colors shrink-0 overflow-hidden text-[#5f6368] hover:bg-[var(--color-surface-hover)]"
      >
        <div className="w-9 h-9 shrink-0 flex items-center justify-center">
          {DOCS_ITEM.icon}
        </div>
        <span className="text-[13px] font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
          {DOCS_ITEM.label}
        </span>
      </Link>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Bottom links */}
      <div className="border-t border-[var(--color-border)] mx-1 pt-1.5 mt-1.5 shrink-0">
        <Link
          href="/docs/proposal"
          title="City Proposal"
          className="flex items-center gap-3 px-1 h-10 rounded-lg transition-colors overflow-hidden text-[#5f6368] hover:bg-[var(--color-surface-hover)]"
        >
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
              <polyline points="14 2 14 8 20 8" />
              <line x1="16" y1="13" x2="8" y2="13" />
              <line x1="16" y1="17" x2="8" y2="17" />
              <polyline points="10 9 9 9 8 9" />
            </svg>
          </div>
          <span className="text-[13px] font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
            City Proposal
          </span>
        </Link>
        <a
          href="https://discord.gg/fTSpY7QWWd"
          target="_blank"
          rel="noopener noreferrer"
          title="Join the Discord"
          className="flex items-center gap-3 px-1 h-10 rounded-lg transition-colors overflow-hidden text-[#5865F2] hover:bg-[#eef0ff]"
        >
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.11 13.11 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
            </svg>
          </div>
          <span className="text-[13px] font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
            Join Discord
          </span>
        </a>
        <a
          href="mailto:bikeshare@grassrootswork.org"
          title="Email us"
          className="flex items-center gap-3 px-1 h-10 rounded-lg transition-colors overflow-hidden text-[#5f6368] hover:bg-[var(--color-surface-hover)]"
        >
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="M22 7l-10 7L2 7" />
            </svg>
          </div>
          <span className="text-[13px] font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
            Email Us
          </span>
        </a>
      </div>
    </nav>
  );
}

function DesktopNavLink({
  item,
  href,
  active,
}: {
  item: NavDef;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
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
    </Link>
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
  return (
    <nav className="fixed bottom-0 left-0 right-0 h-14 bg-white border-t border-[var(--color-border)] flex items-stretch z-50 pb-safe">
      {NAV_ITEMS.map((item) => {
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
      <Link
        href="/docs"
        className="flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors text-[#5f6368]"
      >
        <span className="[&>svg]:w-5 [&>svg]:h-5">{DOCS_ITEM.icon}</span>
        <span className="text-[10px] font-medium">{DOCS_ITEM.shortLabel}</span>
      </Link>
    </nav>
  );
}
