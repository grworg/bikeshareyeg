"use client";

import Link from "next/link";

// ---------------------------------------------------------------------------
// Thin icon rail — Google Maps-style mode switcher
// ---------------------------------------------------------------------------

export type AppMode = "routing" | "designer" | "saved";

interface SideNavProps {
  mode: AppMode;
  onChangeMode: (mode: AppMode) => void;
}

export default function SideNav({ mode, onChangeMode }: SideNavProps) {
  return (
    <nav className="w-[48px] h-full bg-white flex flex-col items-center py-3 gap-1 shrink-0 z-40 shadow-[1px_0_4px_rgba(0,0,0,0.06)]">
      {/* Logo / branding */}
      <div className="w-9 h-9 rounded-full bg-[#e8f0fe] flex items-center justify-center mb-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5.5" cy="17" r="3.5" />
          <circle cx="18.5" cy="17" r="3.5" />
          <path d="M15 6a1 1 0 100-2 1 1 0 000 2z" fill="#1a73e8" stroke="none" />
          <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
        </svg>
      </div>

      <NavButton
        active={mode === "routing"}
        onClick={() => onChangeMode("routing")}
        title="Trip Planner"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="10" r="3" />
            <path d="M12 2a8 8 0 00-8 8c0 5.4 7 12 8 12s8-6.6 8-12a8 8 0 00-8-8z" />
          </svg>
        }
      />

      <NavButton
        active={mode === "designer"}
        onClick={() => onChangeMode("designer")}
        title="Network Designer"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
        }
      />

      <NavButton
        active={mode === "saved"}
        onClick={() => onChangeMode("saved")}
        title="Saved Networks"
        icon={
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
        }
      />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Docs link — pushed to bottom */}
      <Link
        href="/docs"
        title="Documentation"
        className="w-10 h-10 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 3h6a4 4 0 014 4v14a3 3 0 00-3-3H2z" />
          <path d="M22 3h-6a4 4 0 00-4 4v14a3 3 0 013-3h7z" />
        </svg>
      </Link>
    </nav>
  );
}

function NavButton({
  active,
  onClick,
  title,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${
        active
          ? "bg-[#e8f0fe] text-[#1a73e8]"
          : "text-[#5f6368] hover:bg-[var(--color-surface-hover)]"
      }`}
    >
      {icon}
    </button>
  );
}
