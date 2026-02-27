import type { AppMode } from "@/lib/types";

export function modeFromPathname(pathname: string): AppMode {
  if (pathname.startsWith("/designer")) return "designer";
  if (pathname.startsWith("/saved")) return "saved";
  if (pathname.startsWith("/docs")) return "docs";
  return "routing";
}

export function hrefForMode(mode: AppMode, activeNetworkId: string | null): string {
  switch (mode) {
    case "routing": return activeNetworkId ? `/routing/${activeNetworkId}` : "/routing";
    case "designer": return activeNetworkId ? `/designer/${activeNetworkId}` : "/designer";
    case "saved": return "/saved";
    case "docs": return "/docs";
  }
}
