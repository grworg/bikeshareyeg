/**
 * localStorage persistence for saved bike-share network drafts.
 *
 * All drafts live under a single key as a JSON array.  Each entry
 * is a versioned SavedNetwork object so we can migrate later.
 */

import type { SavedNetwork } from "@/lib/types";

const STORAGE_KEY = "bikeshareyeg_saved_networks";

// ---------------------------------------------------------------------------
// Read / write
// ---------------------------------------------------------------------------

export function listSavedNetworks(): SavedNetwork[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Sort newest-first
    return (parsed as SavedNetwork[]).sort(
      (a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime(),
    );
  } catch {
    return [];
  }
}

export function getSavedNetwork(id: string): SavedNetwork | null {
  return listSavedNetworks().find((n) => n.id === id) ?? null;
}

export function saveNetwork(draft: SavedNetwork): void {
  const existing = listSavedNetworks();
  // Upsert by id
  const idx = existing.findIndex((n) => n.id === draft.id);
  if (idx >= 0) {
    existing[idx] = draft;
  } else {
    existing.unshift(draft);
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function deleteSavedNetwork(id: string): void {
  const existing = listSavedNetworks().filter((n) => n.id !== id);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
}

export function renameSavedNetwork(id: string, name: string): void {
  const all = listSavedNetworks();
  const entry = all.find((n) => n.id === id);
  if (entry) {
    entry.name = name;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  }
}
