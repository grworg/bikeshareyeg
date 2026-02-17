"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DOC_SECTIONS, type DocSection } from "@/app/docs/content";

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
// DocsNav — sidebar navigation tree
// ---------------------------------------------------------------------------

interface DocsNavProps {
  activeId: string;
  onNavigate: (id: string) => void;
}

export function DocsNav({ activeId, onNavigate }: DocsNavProps) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const handleToggle = useCallback((id: string) => {
    setCollapsed((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const handleNavigate = useCallback(
    (id: string) => {
      // Auto-expand parent
      for (const s of DOC_SECTIONS) {
        if (s.children?.some((c) => c.id === id)) {
          setCollapsed((prev) => ({ ...prev, [s.id]: false }));
        }
      }
      onNavigate(id);
    },
    [onNavigate],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 pt-4 pb-3 border-b border-[var(--color-border)]">
        <h1 className="text-[16px] font-medium text-[var(--color-fg)]">Documentation</h1>
        <p className="text-[12px] text-[var(--color-secondary)] mt-0.5">
          Guides &amp; technical reference
        </p>
      </div>

      {/* Nav tree */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {DOC_SECTIONS.map((section) => (
            <DocsNavItem
              key={section.id}
              section={section}
              activeId={activeId}
              depth={0}
              collapsed={collapsed}
              onToggle={handleToggle}
              onNavigate={handleNavigate}
            />
          ))}
        </ul>
      </nav>
    </div>
  );
}

function DocsNavItem({
  section,
  activeId,
  depth,
  collapsed,
  onToggle,
  onNavigate,
}: {
  section: DocSection;
  activeId: string;
  depth: number;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  const hasChildren = !!section.children?.length;
  const isActive = activeId === section.id;
  const isParentActive = hasChildren && section.children!.some((c) => c.id === activeId);
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
              ? "bg-[#e8f0fe] text-[#1a73e8]"
              : "text-[var(--color-secondary)] hover:bg-[var(--color-surface-hover)] hover:text-[var(--color-fg)]"
          }
        `}
      >
        {hasChildren && (
          <svg
            width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
            className={`shrink-0 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          >
            <polyline points="9 18 15 12 9 6" />
          </svg>
        )}
        <span className="truncate">{section.shortTitle ?? section.title}</span>
      </button>

      {hasChildren && isOpen && (
        <ul className="mt-0.5 space-y-0.5">
          {section.children!.map((child) => (
            <DocsNavItem
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
// DocsContent — scrollable content area (replaces the map when in docs mode)
// ---------------------------------------------------------------------------

interface DocsContentProps {
  activeId: string;
  onActiveChange: (id: string) => void;
  scrollToId: string | null;
  onScrollHandled: () => void;
}

export function DocsContent({ activeId, onActiveChange, scrollToId, onScrollHandled }: DocsContentProps) {
  const mainRef = useRef<HTMLDivElement>(null);
  const allSections = useMemo(() => flattenSections(DOC_SECTIONS), []);

  // Scroll spy
  useEffect(() => {
    const container = mainRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            onActiveChange(entry.target.id);
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
  }, [allSections, onActiveChange]);

  // Programmatic scroll-to when nav is clicked
  useEffect(() => {
    if (!scrollToId) return;
    const container = mainRef.current;
    const el = document.getElementById(scrollToId);
    if (container && el) {
      const top = el.offsetTop - 80;
      container.scrollTo({ top: Math.max(0, top), behavior: "instant" });
    }
    onScrollHandled();
  }, [scrollToId, onScrollHandled]);

  return (
    <div ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain bg-white">
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
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            BikeShareYEG Documentation
          </h1>
          <p className="mt-3 text-base text-gray-500 leading-relaxed">
            Learn how to design, optimize, and evaluate bike-share networks for Edmonton.
          </p>
        </div>

        {DOC_SECTIONS.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>
    </div>
  );
}

function SectionBlock({ section, depth = 0 }: { section: DocSection; depth?: number }) {
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
