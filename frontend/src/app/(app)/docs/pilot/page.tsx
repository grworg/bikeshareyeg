"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Menu } from "lucide-react";
import { PILOT_SECTIONS } from "./content";
import type { DocSection } from "../content";
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

function TocNav({
  activeId,
  onNavigate,
}: {
  activeId: string;
  onNavigate: (id: string) => void;
}) {
  return (
    <ul className="space-y-0.5">
      {PILOT_SECTIONS.map((section) => (
        <NavItem
          key={section.id}
          section={section}
          activeId={activeId}
          onNavigate={onNavigate}
        />
      ))}
    </ul>
  );
}

export default function PilotPage() {
  const isMobile = useIsMobile();
  const [activeId, setActiveId] = useState(PILOT_SECTIONS[0]?.id ?? "");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const allSections = useMemo(() => flattenSections(PILOT_SECTIONS), []);
  const isScrollingRef = useRef(false);

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

  const handleNavigate = useCallback((id: string) => {
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
    <div className="max-w-3xl mx-auto px-6 sm:px-10 py-8 pb-32">
      <div className="mb-8 pb-8 border-b border-gray-200">
        <p className="text-sm font-semibold text-blue-600 mb-2 uppercase tracking-wider">
          Pilot Proposal
        </p>
        <h1 className="text-4xl font-bold text-gray-900 tracking-tight">
          Proof-of-Concept Pilot
        </h1>
        <p className="mt-3 text-lg text-gray-500 leading-relaxed">
          12 stations. 120 bikes. One corridor. One season of real data
          before committing to the full network.
        </p>
      </div>
      {PILOT_SECTIONS.map((section) => (
        <SectionBlock key={section.id} section={section} />
      ))}
    </div>
  );

  if (isMobile === undefined) {
    return <div className="h-full bg-[var(--color-surface)]" />;
  }

  if (isMobile) {
    return (
      <div className="flex flex-col h-full bg-[var(--color-surface)]">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 bg-[var(--color-surface)] sticky top-0 z-10 shrink-0">
          <button
            onClick={() => setDrawerOpen(true)}
            className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors shrink-0"
          >
            <Menu size={20} className="text-gray-600" />
          </button>
          <span className="text-[14px] font-semibold text-gray-900 truncate">Pilot Proposal</span>
        </div>

        <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
          {mainContent}
        </main>

        <MobileDocsDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Pilot Sections">
          <TocNav activeId={activeId} onNavigate={handleNavigate} />
        </MobileDocsDrawer>
      </div>
    );
  }

  return (
    <div className="flex h-full bg-[var(--color-surface)]">
      <aside className="w-[260px] shrink-0 border-r border-gray-200 flex flex-col h-full">
        <div className="px-4 pt-4 pb-2">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">
            Pilot Sections
          </p>
        </div>
        <nav className="flex-1 overflow-y-auto overscroll-contain py-2 px-3">
          <TocNav activeId={activeId} onNavigate={handleNavigate} />
        </nav>
      </aside>

      <main ref={mainRef} className="flex-1 overflow-y-auto overscroll-contain">
        {mainContent}
      </main>
    </div>
  );
}
