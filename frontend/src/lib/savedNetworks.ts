/**
 * localStorage persistence for saved bike-share network drafts and
 * owner secrets for shared networks.
 *
 * All drafts live under a single key as a JSON array.  Each entry
 * is a versioned SavedNetwork object so we can migrate later.
 *
 * Owner secrets (256-bit hex strings) are stored separately so they
 * never leave the browser unless the user explicitly sends them.
 */

import type { SavedNetwork } from "@/lib/types";
import { cityConfig } from "@/lib/cityConfig";

const _prefix = `bikeshare_${cityConfig.shortCode.toLowerCase()}`;
const STORAGE_KEY = `${_prefix}_saved_networks`;
const OWNER_SECRETS_KEY = `${_prefix}_owner_secrets`;

// ---------------------------------------------------------------------------
// Read / write — saved networks
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
  const idx = existing.findIndex((n) => n.id === draft.id);
  if (idx >= 0) {
    existing[idx] = draft;
  } else {
    existing.unshift(draft);
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch {
    console.warn("localStorage quota exceeded — pruning oldest networks");
    while (existing.length > 1) {
      existing.pop();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
        return;
      } catch { /* keep pruning */ }
    }
  }
}

export function deleteSavedNetwork(id: string): void {
  const existing = listSavedNetworks().filter((n) => n.id !== id);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(existing)); } catch { /* quota */ }
}

export function renameSavedNetwork(id: string, name: string): void {
  const all = listSavedNetworks();
  const entry = all.find((n) => n.id === id);
  if (entry) {
    entry.name = name;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(all)); } catch { /* quota */ }
  }
}

// ---------------------------------------------------------------------------
// Owner secrets — write-access tokens for shared networks
// ---------------------------------------------------------------------------

function _readSecrets(): Record<string, string> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(OWNER_SECRETS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function _writeSecrets(secrets: Record<string, string>): void {
  try { localStorage.setItem(OWNER_SECRETS_KEY, JSON.stringify(secrets)); } catch { /* quota */ }
}

/** Generate a 256-bit cryptographically random hex secret. */
export function generateOwnerSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** SHA-256 hash a raw secret (returns hex string). */
export async function hashOwnerSecret(secret: string): Promise<string> {
  const encoded = new TextEncoder().encode(secret);
  const hash = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Store an owner secret keyed by the server-assigned share UUID. */
export function storeOwnerSecret(shareId: string, secret: string): void {
  const secrets = _readSecrets();
  secrets[shareId] = secret;
  _writeSecrets(secrets);
}

/** Retrieve the owner secret for a shared network, or null if not owned. */
export function getOwnerSecret(shareId: string): string | null {
  return _readSecrets()[shareId] ?? null;
}

/** Remove the owner secret for a shared network. */
export function removeOwnerSecret(shareId: string): void {
  const secrets = _readSecrets();
  delete secrets[shareId];
  _writeSecrets(secrets);
}
