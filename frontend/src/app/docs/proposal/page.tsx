"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { PROPOSAL_SECTIONS } from "./content";
import type { DocSection } from "../content";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function flattenSections(sections: DocSection[]): DocSection[] {
  const result: DocSection[] = [];
  for (const s of sections) {
    result.push(s);
    if (s.children?.length) result.push(...flattenSections(s.children));
  }
  return result;
}

// ---------------------------------------------------------------------------
// Sidebar nav item
// ---------------------------------------------------------------------------

function NavItem({
  section,
  activeId,
  onNavigate,
}: {
  section: DocSection;
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  const isActive = activeId === section.id;

  return (
    <li>
      <button
        onClick={() => onNavigate(section.id)}
        className={`
          w-full text-left flex items-center gap-1.5 py-1.5 px-3 rounded-md text-[13px] leading-snug transition-colors font-medium
          ${
            isActive
              ? "bg-blue-50 text-blue-700"
              : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
          }
        `}
      >
        <span className="truncate">
          {section.shortTitle ?? section.title}
        </span>
      </button>
    </li>
  );
}

// ---------------------------------------------------------------------------
// Section renderer
// ---------------------------------------------------------------------------

function SectionBlock({ section }: { section: DocSection }) {
  return (
    <>
      <h2
        id={section.id}
        className="text-2xl font-bold text-gray-900 mt-12 mb-4 scroll-mt-20"
      >
        {section.title}
      </h2>
      {section.content && (
        <div
          className="prose-section text-[15px] leading-relaxed text-gray-700"
          dangerouslySetInnerHTML={{ __html: section.content }}
        />
      )}
      {section.children?.map((child) => (
        <div key={child.id}>
          <h3
            id={child.id}
            className="text-xl font-semibold text-gray-800 mt-8 mb-3 scroll-mt-20"
          >
            {child.title}
          </h3>
          {child.content && (
            <div
              className="prose-section text-[15px] leading-relaxed text-gray-700"
              dangerouslySetInnerHTML={{ __html: child.content }}
            />
          )}
        </div>
      ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main proposal page
// ---------------------------------------------------------------------------

export default function ProposalPage() {
  const [activeId, setActiveId] = useState(PROPOSAL_SECTIONS[0]?.id ?? "");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);

  const allSections = useMemo(() => flattenSections(PROPOSAL_SECTIONS), []);
  const isScrollingRef = useRef(false);

  // ---- Read hash on mount ----
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
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

  // ---- Scroll spy ----
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

  const handleNavigate = useCallback((id: string) => {
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
      setTimeout(() => {
        isScrollingRef.current = false;
      }, 100);
    });
    setMobileNavOpen(false);
  }, []);

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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1a73e8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="5.5" cy="17" r="3.5" />
              <circle cx="18.5" cy="17" r="3.5" />
              <path d="M15 6a1 1 0 100-2 1 1 0 000 2z" fill="#1a73e8" stroke="none" />
              <path d="M12 17V13l-3.5-4 4.5-2.5 2.5 4.5h3" />
            </svg>
          </div>
          <span className="font-semibold text-[15px]">BikeShareYEG</span>
        </Link>

        <span className="text-gray-300 text-sm hidden sm:inline">/</span>
        <span className="text-gray-500 text-sm font-medium hidden sm:inline">
          Proposal
        </span>

        <div className="flex-1" />

        <Link
          href="/docs"
          className="text-[13px] font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Documentation
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
            w-[260px] h-[calc(100vh-56px)] lg:h-auto bg-white border-r border-gray-200
            flex flex-col
            transition-transform duration-200 lg:transition-none
            ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            shrink-0
          `}
        >
          <nav className="flex-1 overflow-y-auto overscroll-contain py-4 px-3">
            <div className="px-3 mb-3">
              <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
                Proposal Sections
              </p>
            </div>
            <ul className="space-y-0.5">
              {PROPOSAL_SECTIONS.map((section) => (
                <NavItem
                  key={section.id}
                  section={section}
                  activeId={activeId}
                  onNavigate={handleNavigate}
                />
              ))}
            </ul>
          </nav>

          {/* Pinned bottom links */}
          <div className="shrink-0 px-4 py-3 border-t border-gray-100 space-y-1">
            <Link
              href="/docs"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
                <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
              </svg>
              Documentation
            </Link>
            <Link
              href="/"
              className="flex items-center gap-2.5 px-3 py-2 rounded-md text-[13px] text-gray-500 hover:bg-gray-50 hover:text-gray-700 transition-colors"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              Network Planner App
            </Link>
          </div>
        </aside>

        {/* ---- Content ---- */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 pb-32">
            {/* Title block */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              <p className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wider">
                Proposal
              </p>
              <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
                A Bike-Share System for Edmonton
              </h1>
              <p className="mt-3 text-lg text-gray-500 leading-relaxed">
                Public ownership. Local manufacturing. No vendor lock-in.
                A plan for a bike-share system that belongs to Edmontonians.
              </p>
            </div>

            {/* Render all sections */}
            {PROPOSAL_SECTIONS.map((section) => (
              <SectionBlock key={section.id} section={section} />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
