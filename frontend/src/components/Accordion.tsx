"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronRight } from "lucide-react";

interface AccordionProps {
  title: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

/**
 * Collapsible section with smooth height animation.
 * Used in PlannerControls to group related settings.
 */
export default function Accordion({ title, defaultOpen = false, children }: AccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [height, setHeight] = useState<number | "auto">(defaultOpen ? "auto" : 0);

  useEffect(() => {
    if (!bodyRef.current) return;
    if (isOpen) {
      // Expand: measure scroll height, set it, then switch to auto
      const h = bodyRef.current.scrollHeight;
      setHeight(h);
      const timer = setTimeout(() => setHeight("auto"), 200);
      return () => clearTimeout(timer);
    } else {
      // Collapse: set current height explicitly, then 0 in next frame
      const h = bodyRef.current.scrollHeight;
      setHeight(h);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setHeight(0));
      });
    }
  }, [isOpen]);

  return (
    <div className="border-t border-[var(--color-border)]">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center gap-2 px-5 py-2.5 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <ChevronRight
          size={12}
          strokeWidth={2.5}
          className={`shrink-0 text-[var(--color-secondary)] transition-transform duration-200 ${isOpen ? "rotate-90" : ""}`}
        />
        <span className="text-[11px] font-medium text-[var(--color-secondary)] uppercase tracking-wider">
          {title}
        </span>
      </button>
      <div
        ref={bodyRef}
        className="overflow-hidden transition-[height] duration-200 ease-out"
        style={{ height: typeof height === "number" ? `${height}px` : "auto" }}
      >
        {children}
      </div>
    </div>
  );
}
