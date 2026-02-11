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

  // ---- Scroll spy (observes within <main>) ----
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
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

      // Scroll within the <main> scroll container, not the body
      requestAnimationFrame(() => {
        const container = mainRef.current;
        const el = document.getElementById(id);
        if (container && el) {
          const top = el.offsetTop - 80; // offset for sticky header
          container.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
          setActiveId(id);
        }
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
          href="/"
          className="text-[13px] font-medium text-blue-600 hover:text-blue-800 transition-colors flex items-center gap-1"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          Back to App
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
            overflow-y-auto overscroll-contain
            transition-transform duration-200 lg:transition-none
            ${mobileNavOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}
            shrink-0
          `}
        >
          <nav className="py-4 px-3">
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
          </nav>
        </aside>

        {/* ---- Content ---- */}
        <main
          ref={mainRef}
          className="flex-1 overflow-y-auto overscroll-contain"
        >
          <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 pb-32">
            {/* Hero */}
            <div className="mb-8 pb-8 border-b border-gray-200">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/docs/hero-banner.png"
                alt="BikeShareYEG — Edmonton's bike-share planning tool"
                width={960}
                height={300}
                decoding="async"
                className="w-full h-auto rounded-lg border border-gray-200 mb-6"
              />
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
