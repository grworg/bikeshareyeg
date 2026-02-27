"use client";

import { useState, useEffect } from "react";

/**
 * Returns true when the viewport is narrower than `breakpoint` (default 768 = Tailwind `md`).
 * Returns `undefined` on the very first server/hydration render so callers can
 * avoid a layout flash (e.g. briefly showing a desktop sidebar on mobile).
 */
export function useIsMobile(breakpoint = 768): boolean | undefined {
  const [value, setValue] = useState<boolean | undefined>(undefined);

  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    setValue(mq.matches);
    const handler = (e: MediaQueryListEvent) => setValue(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);

  return value;
}
