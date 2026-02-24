"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { DOC_SECTIONS, type DocSection } from "./content";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Flatten the section tree for scroll-spy lookup. */
function flattenSections(sections: DocSection[]): DocSection[] {
  const result: DocSection[] = [];
  for (const s of sections) {
    result.push(s);
    if (s.children?.length) {
      result.push(...flattenSections(s.children));
    }
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sidebar nav item
// ---------------------------------------------------------------------------

function NavItem({
  section,
  activeId,
  depth = 0,
  collapsed,
  onToggle,
  onNavigate,
}: {
  section: DocSection;
  activeId: string;
  depth?: number;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const hasChildren = !!section.children?.length;
  const isActive = activeId === section.id;
  const isParentActive =
    hasChildren && section.children!.some((c) => c.id === activeId);
  const isOpen = !collapsed[section.id];

  return (
    <li>
      <button
        onClick={() => {
          if (hasChildren) onToggle(section.id);
          onNavigate(section.id);
        }}
        className={`
          w-full text-left flex items-center gap-1.5 py-1.5 pr-2 rounded-md text-[13px] leading-snug transition-colors
          ${depth === 0 ? "pl-3 font-semibold" : "pl-7 font-normal"}
          ${
            isActive || isParentActive
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }
        `}
      >
        {hasChildren && (
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${
              isOpen ? "rotate-90" : ""
            }`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        <span className="truncate">
          {section.shortTitle ?? section.title}
        </span>
      </button>

      {hasChildren && isOpen && (
        <ul className="mt-0.5 space-y-0.5">
          {section.children!.map((child) => (
            <NavItem
              key={child.id}
              section={child}
              activeId={activeId}
              depth={depth + 1}
              collapsed={collapsed}
              onToggle={onToggle}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function SectionBlock({
  section,
  depth = 0,
}: {
  section: DocSection;
  depth?: number;
}) {
  const Tag = depth === 0 ? "h2" : "h3";
  const headingClass =
    depth === 0
      ? "text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-20"
      : "text-xl font-semibold text-gray-800 mt-8 mb-3 scroll-mt-20";

  return (
    <>
      <Tag id={section.id} className={headingClass}>
        {section.title}
      </Tag>
      {section.content && (
        <div
          className="prose-section text-[15px] leading-relaxed text-gray-700"
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      )}
      {section.children?.map((child) => (
        <SectionBlock key={child.id} section={child} depth={depth + 1} />
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main docs page
// ---------------------------------------------------------------------------

export default function DocsPage() {
  const [activeId, setActiveId] = useState(DOC_SECTIONS[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const allSections = useMemo(() => flattenSections(DOC_SECTIONS), []);
  const isScrollingRef = useRef(false);

  // ---- Read hash on mount and scroll to that section ----
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
    // Auto-expand parent so the target is in the DOM
    for (const s of DOC_SECTIONS) {
      if (s.id === hash || s.children?.some((c) => c.id === hash)) {
        setCollapsed((prev) => ({ ...prev, [s.id]: false }));
      }
    }
    requestAnimationFrame(() => {
      const container = mainRef.current;
      const el = document.getElementById(hash);
      if (container && el) {
        const top = el.offsetTop - 80;
        container.scrollTo({ top: Math.max(0, top), behavior: "instant" });
        setActiveId(hash);
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Scroll spy (observes within <main>) ----
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (isScrollingRef.current) return;
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
            window.history.replaceState(null, "", `#${entry.target.id}`);
            break;
          }
        }
      },
      { root: container, rootMargin: "-80px 0px -70% 0px", threshold: 0 },
    );

    for (const s of allSections) {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [allSections]);

  const handleToggle = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleNavigate = useCallback(
    (id: string) => {
      // Auto-expand parent first so the target element is in the DOM
      for (const s of DOC_SECTIONS) {
        if (s.children?.some((c) => c.id === id)) {
          setCollapsed((prev) => ({ ...prev, [s.id]: false }));
        }
      }

      // Scroll instantly within the <main> scroll container
      isScrollingRef.current = true;
      requestAnimationFrame(() => {
        const container = mainRef.current;
        const el = document.getElementById(id);
        if (container && el) {
          const top = el.offsetTop - 80;
          container.scrollTo({ top: Math.max(0, top), behavior: "instant" });
          setActiveId(id);
          window.history.pushState(null, "", `#${id}`);
        }
        setTimeout(() => { isScrollingRef.current = false; }, 100);
      });
      setMobileNavOpen(false);
    },
    [],
  );

  return (
    <div className="h-screen bg-white flex flex-col overflow-hidden">
      {/* ---- Top bar ---- */}
      <header className="z-50 h-14 bg-white border-b border-gray-200 flex items-center px-4 gap-3 shrink-0">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileNavOpen(!mobileNavOpen)}
          className="lg:hidden w-9 h-9 flex items-center justify-center rounded-md hover:bg-gray-100"
          aria-label="Toggle navigation"
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="3" y1="6" x2="21" y2="6" />
            <line x1="3" y1="12" x2="21" y2="12" />
            <line x1="3" y1="18" x2="21" y2="18" />
          </svg>
        </button>

        {/* Logo + title */}
        <Link
          href="/"
          className="flex items-center gap-2.5 text-gray-700 hover:text-blue-600 transition-colors"
        >
          <div className="w-8 h-8 rounded-full bg-blue-50 flex items-center justify-center">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#1a73e8"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5.5" cy="17" r="3.5" />
              <circle cx="18.5" cy="17" r="3.5" />
              <path
                d="M15 6a1 1 0 100-2 1 1 0 000 2z"
                fill="#1a73e8"
                stroke="none"
              />
              <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
            </svg>
          </div>
          <span className="font-semibold text-[15px]">BikeShareYEG</span>
        </Link>

        <span className="text-gray-300 text-sm hidden sm:inline">/</span>
        <span className="text-gray-500 text-sm font-medium hidden sm:inline">
          Documentation
        </span>

        <div className="flex-1" />

        <Link
          href="/docs/proposal"
          className="text-[13px] font-medium text-blue-600 hover:text-blue-800 transition-colors"
        >
          Proposal
        </Link>

        <Link
          href="/"
          className="text-[13px] font-medium text-gray-500 hover:text-gray-700 transition-colors flex items-center gap-1"
        >
          App
        </Link>
      </header>

      <div className="flex flex-1 min-h-0">
        {/* ---- Mobile overlay ---- */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 bg-black/30 z-40 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* ---- Sidebar ---- */}
        <aside
          className={`
            fixed lg:relative top-14 lg:top-0 z-40 lg:z-auto
            w-[280px] h-[calc(100vh-56px)] lg:h-auto bg-white border-r border-gray-200
            flex flex-col
            transition-transform duration-200 lg:transition-none
            ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            shrink-0
          `}
        >
          <nav className="py-4 px-3 flex-1 overflow-y-auto overscroll-contain">
            <ul className="space-y-1">
              {DOC_SECTIONS.map((section) => (
                <NavItem
                  key={section.id}
                  section={section}
                  activeId={activeId}
                  collapsed={collapsed}
                  onToggle={handleToggle}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>

            {/* Proposal callout */}
            <Link
              href="/docs/proposal"
              className="block mt-6 mx-1 p-3 rounded-lg bg-blue-50 border border-blue-100 hover:bg-blue-100 transition-colors group"
            >
              <p className="text-[13px] font-semibold text-blue-700 group-hover:text-blue-800">
                City Proposal
              </p>
              <p className="text-[11px] text-blue-600/70 mt-0.5 leading-snug">
                A plan for public bike-share in Edmonton — governance, budget, hardware, and timeline.
              </p>
            </Link>
          </nav>

          {/* Get Involved footer */}
          <div className="shrink-0 border-t border-gray-200 px-4 py-3 bg-gray-50">
            <p className="text-[11px] font-medium text-gray-400 mb-2">Get Involved</p>
            <div className="flex items-center gap-2">
              <a
                href="https://discord.gg/fTSpY7QWWd"
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 flex items-center justify-center gap-1.5 h-8 rounded-md text-[12px] font-medium text-white bg-[#5865F2] hover:bg-[#4752c4] transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M20.317 4.37a19.79 19.79 0 00-4.885-1.515.074.074 0 00-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 00-5.487 0 12.64 12.64 0 00-.617-1.25.077.077 0 00-.079-.037A19.74 19.74 0 003.677 4.37a.07.07 0 00-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 00.031.057 19.9 19.9 0 005.993 3.03.078.078 0 00.084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 00-.041-.106 13.11 13.11 0 01-1.872-.892.077.077 0 01-.008-.128 10.2 10.2 0 00.372-.292.074.074 0 01.077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 01.078.01c.12.098.246.198.373.292a.077.077 0 01-.006.127 12.3 12.3 0 01-1.873.892.077.077 0 00-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 00.084.028 19.84 19.84 0 006.002-3.03.077.077 0 00.032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 00-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.095 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
                </svg>
                Discord
              </a>
              <a
                href="mailto:bikeshare@grassrootswork.org"
                className="flex items-center justify-center gap-1.5 h-8 px-3 rounded-md text-[12px] font-medium text-gray-500 border border-gray-200 hover:bg-gray-100 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="2" y="4" width="20" height="16" rx="2" />
                  <path d="M22 7l-10 7L2 7" />
                </svg>
                Email
              </a>
            </div>
          </div>
        </aside>

        {/* ---- Content ---- */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          {/* Hero banner — full width */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/docs/hero-banner.jpg"
            alt="BikeShareYEG — Edmonton's bike-share planning tool"
            decoding="async"
            className="w-full h-auto"
          />

          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 pb-32">
            {/* Hero text */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                BikeShareYEG Documentation
              </h1>
              <p className="mt-3 text-lg text-gray-500 leading-relaxed">
                Learn how to design, optimize, and evaluate bike-share networks
                for Edmonton — from quick-start guides to deep technical
                details.
              </p>
            </div>

            {/* Render all sections */}
            {DOC_SECTIONS.map((section) => (
              <SectionBlock key={section.id} section={section} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
