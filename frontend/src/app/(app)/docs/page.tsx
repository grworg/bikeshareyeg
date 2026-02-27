"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronRight, Menu } from "lucide-react";
import { DOC_SECTIONS, type DocSection } from "./content";
import { cityConfig } from "@/lib/cityConfig";
import { useIsMobile } from "@/lib/useMediaQuery";
import MobileDocsDrawer from "@/components/MobileDocsDrawer";

function flattenSections(sections: DocSection[]): DocSection[] {
  const result: DocSection[] = [];
  for (const s of sections) {
    result.push(s);
    if (s.children?.length) result.push(...flattenSections(s.children));
  }
  return result;
}

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
          <ChevronRight
            size={12}
            strokeWidth={2.5}
            className={`shrink-0 transition-transform duration-150 ${isOpen ? "rotate-90" : ""}`}
          />
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

function TocNav({
  activeId,
  collapsed,
  onToggle,
  onNavigate,
}: {
  activeId: string;
  collapsed: Record<string, boolean>;
  onToggle: (id: string) => void;
  onNavigate: (id: string) => void;
}) {
  return (
    <ul className="space-y-1">
      {DOC_SECTIONS.map((section) => (
        <NavItem
          key={section.id}
          section={section}
          activeId={activeId}
          collapsed={collapsed}
          onToggle={onToggle}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

export default function DocsPage() {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState(DOC_SECTIONS[0]?.id ?? "");
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const allSections = useMemo(() => flattenSections(DOC_SECTIONS), []);
  const isScrollingRef = useRef(false);

  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (!hash) return;
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
    // Mount-only: scroll to hash anchor on initial page load
  }, []);

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

  const handleNavigate = useCallback((id: string) => {
    for (const s of DOC_SECTIONS) {
      if (s.children?.some((c) => c.id === id)) {
        setCollapsed((prev) => ({ ...prev, [s.id]: false }));
      }
    }
    setDrawerOpen(false);
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
  }, []);

  const mainContent = (
    <>
      <Image
        src="/docs/hero-banner.jpg"
        alt={`${cityConfig.appName} — ${cityConfig.name} bike-share planning tool`}
        width={1200}
        height={630}
        priority
        className="w-full h-auto"
      />
      <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 pb-32">
        <div className="mb-8 pb-8 border-b border-gray-200">
          <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
            {cityConfig.appName} Documentation
          </h1>
          <p className="mt-3 text-lg text-gray-500 leading-relaxed">
            Learn how to design, optimize, and evaluate bike-share networks
            for {cityConfig.name} — from quick-start guides to deep technical details.
          </p>
        </div>
        {DOC_SECTIONS.map((section) => (
          <SectionBlock key={section.id} section={section} />
        ))}
      </div>
    </>
  );

  if (isMobile === undefined) {
    return <div className="h-full bg-[var(--color-surface)]" />;
  }

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-surface)]">
        {/* Sticky top bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-[var(--color-surface)] sticky top-0 z-10 shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <span className="text-[14px] font-semibold text-gray-900 truncate">Documentation</span>
        </div>

        <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
          {mainContent}
        </main>

        <MobileDocsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Documentation">
          <TocNav
            activeId={activeId}
            collapsed={collapsed}
            onToggle={handleToggle}
            onNavigate={handleNavigate}
          />
        </MobileDocsDrawer>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[var(--color-surface)]">
      {/* TOC sidebar — desktop only */}
      <aside className="w-[280px] shrink-0 border-r border-gray-200 flex flex-col h-full">
        <div className="px-4 pt-4 pb-2">
          <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Documentation
          </h2>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain py-2 px-3">
          <TocNav
            activeId={activeId}
            collapsed={collapsed}
            onToggle={handleToggle}
            onNavigate={handleNavigate}
          />
        </nav>
      </aside>

      {/* Content */}
      <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
        {mainContent}
      </main>
    </div>
  );
}
