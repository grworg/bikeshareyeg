"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  MapPin,
  Layers,
  FolderOpen,
  BookOpen,
  FileText,
  FlaskConical,
  Mail,
  Bike,
} from "lucide-react";
import type { AppMode } from "@/lib/types";
import { useNetworkStore } from "@/lib/networkStore";
import { modeFromPathname, hrefForMode } from "@/lib/navigation";
import { cityConfig } from "@/lib/cityConfig";

interface NavDef {
  mode: AppMode;
  label: string;
  shortLabel: string;
  icon: React.ReactNode;
}

const NAV_ITEMS: NavDef[] = [
  { mode: "routing", label: "Trip Planner", shortLabel: "Routes", icon: <MapPin size={20} /> },
  { mode: "designer", label: "Network Designer", shortLabel: "Designer", icon: <Layers size={20} /> },
  { mode: "saved", label: "Saved Networks", shortLabel: "Saved", icon: <FolderOpen size={20} /> },
];

const DOCS_ITEM: NavDef = {
  mode: "docs", label: "Documentation", shortLabel: "Docs", icon: <BookOpen size={20} />,
};

const PILOT_ITEM: NavDef = {
  mode: "docs", label: "Pilot Proposal", shortLabel: "Pilot", icon: <FlaskConical size={20} />,
};

const PROPOSAL_ITEM: NavDef = {
  mode: "docs", label: "City Proposal", shortLabel: "Proposal", icon: <FileText size={20} />,
};

export default function SideNav() {
  const pathname = usePathname();
  const currentMode = modeFromPathname(pathname);
  const activeNetworkId = useNetworkStore((s) => s.activeNetworkId);
  const isPilot = pathname.startsWith("/docs/pilot");
  const isProposal = pathname.startsWith("/docs/proposal");

  return (
    <nav className="group/nav w-12 hover:w-[200px] shrink-0 z-40 bg-[var(--color-surface)] shadow-[1px_0_4px_rgba(0,0,0,0.08)] transition-[width] duration-200 ease-out flex flex-col py-2 overflow-hidden">
      {/* Logo */}
      <div className="flex items-center gap-3 px-1.5 h-10 mb-2 shrink-0">
        <div className="w-9 h-9 shrink-0 rounded-full bg-[var(--color-active-bg)] flex items-center justify-center">
          <Bike size={20} className="text-[var(--color-blue)]" />
        </div>
        <span className="text-[13px] font-semibold text-[var(--color-fg)] whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
          {cityConfig.appName}
        </span>
      </div>

      {NAV_ITEMS.map((item) => (
        <DesktopNavLink
          key={item.mode}
          item={item}
          href={hrefForMode(item.mode, activeNetworkId)}
          active={currentMode === item.mode}
        />
      ))}

      <DesktopNavLink item={DOCS_ITEM} href="/docs" active={currentMode === "docs" && !isProposal && !isPilot} />
      <DesktopNavLink item={PILOT_ITEM} href="/docs/pilot" active={isPilot} />
      <DesktopNavLink item={PROPOSAL_ITEM} href="/docs/proposal" active={isProposal} />

      <div className="flex-1" />

      <div className="border-t border-[var(--color-border)] mx-1 pt-1.5 mt-1.5 shrink-0">
        <a
          href="https://discord.gg/fTSpY7QWWd"
          target="_blank"
          rel="noopener noreferrer"
          title="Join the Discord"
          className="flex items-center gap-3 px-1 h-10 rounded-lg transition-colors overflow-hidden text-[#5865F2] hover:bg-[#eef0ff]"
        >
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <DiscordIcon />
          </div>
          <span className="text-[13px] font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
            Join Discord
          </span>
        </a>
        <a
          href="mailto:bikeshare@grassrootswork.org"
          title="Email us"
          className="flex items-center gap-3 px-1 h-10 rounded-lg transition-colors overflow-hidden text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)]"
        >
          <div className="w-9 h-9 shrink-0 flex items-center justify-center">
            <Mail size={20} />
          </div>
          <span className="text-[13px] font-medium whitespace-nowrap opacity-0 group-hover/nav:opacity-100 transition-opacity duration-150 delay-75">
            Email Us
          </span>
        </a>
      </div>
    </nav>
  );
}

function DiscordIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

function DesktopNavLink({ item, href, active }: { item: NavDef; href: string; active: boolean }) {
  return (
    <Link
      href={href}
      title={item.label}
      className={`flex items-center gap-3 mx-1 px-1 h-10 rounded-lg transition-colors shrink-0 overflow-hidden ${
        active
          ? "bg-[var(--color-active-bg)] text-[var(--color-blue)]"
          : "text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)]"
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

interface MobileTabBarProps {
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
}

export function MobileTabBar({ mode, onChangeMode }: MobileTabBarProps) {
  return (
    <nav className="shrink-0 bg-[var(--color-surface)] border-t border-[var(--color-border)] z-50">
      <div className="h-14 flex items-stretch">
        {NAV_ITEMS.map((item) => {
          const active = mode === item.mode;
          return (
            <button
              key={item.mode}
              onClick={() => onChangeMode(item.mode)}
              className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
                active ? "text-[var(--color-blue)]" : "text-[var(--color-secondary)]"
              }`}
            >
              <span className="[&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
              <span className="text-[10px] font-medium">{item.shortLabel}</span>
            </button>
          );
        })}
        <Link
          href="/docs"
          className={`flex-1 flex flex-col items-center justify-center gap-0.5 transition-colors ${
            mode === "docs" ? "text-[var(--color-blue)]" : "text-[var(--color-secondary)]"
          }`}
        >
          <span className="[&>svg]:w-5 [&>svg]:h-5">{DOCS_ITEM.icon}</span>
          <span className="text-[10px] font-medium">{DOCS_ITEM.shortLabel}</span>
        </Link>
      </div>
      {/* Extend background behind gesture bar / home indicator */}
      <div className="pb-safe" />
    </nav>
  );
}
