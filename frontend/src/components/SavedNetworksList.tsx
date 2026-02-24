"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedNetwork } from "@/lib/types";
import {
  listSavedNetworks,
  deleteSavedNetwork,
  renameSavedNetwork,
  saveNetwork,
  generateOwnerSecret,
  hashOwnerSecret,
  storeOwnerSecret,
  getOwnerSecret,
} from "@/lib/savedNetworks";
import { shareNetwork } from "@/lib/api";

interface SavedNetworksListProps {
  onLoad: (network: SavedNetwork) => void;
  activeNetworkId?: string | null;
}

export default function SavedNetworksList({ onLoad, activeNetworkId }: SavedNetworksListProps) {
  const [networks, setNetworks] = useState<SavedNetwork[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Sharing state
  const [sharingId, setSharingId] = useState<string | null>(null);
  const [shareError, setShareError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const refresh = useCallback(() => setNetworks(listSavedNetworks()), []);
  useEffect(refresh, [refresh]);

  const handleDelete = (id: string) => {
    deleteSavedNetwork(id);
    setConfirmDeleteId(null);
    refresh();
  };

  const handleRename = (id: string) => {
    if (editName.trim()) {
      renameSavedNetwork(id, editName.trim());
      setEditingId(null);
      refresh();
    }
  };

  const handleShare = async (network: SavedNetwork) => {
    setSharingId(network.id);
    setShareError(null);
    try {
      const secret = generateOwnerSecret();
      const hash = await hashOwnerSecret(secret);
      const result = await shareNetwork(hash, network);

      storeOwnerSecret(result.id, secret);

      const updated: SavedNetwork = {
        ...network,
        shareId: result.id,
        sharedAt: new Date().toISOString(),
      };
      saveNetwork(updated);
      refresh();
    } catch (err) {
      setShareError(err instanceof Error ? err.message : "Failed to share");
    } finally {
      setSharingId(null);
    }
  };

  const handleCopyLink = async (shareId: string) => {
    const url = `${window.location.origin}/network/${shareId}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(shareId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback for non-HTTPS or denied clipboard
      prompt("Copy this link:", url);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {networks.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-[#f1f3f4] flex items-center justify-center mb-3">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#9aa0a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
              <polyline points="17 21 17 13 7 13 7 21" />
              <polyline points="7 3 7 8 15 8" />
            </svg>
          </div>
          <p className="text-[13px] font-medium text-[var(--color-fg)] mb-1">
            No saved networks
          </p>
          <p className="text-[12px] text-[var(--color-secondary)] leading-relaxed max-w-[240px]">
            Design a bike-share network, then save it as a draft from the Network Designer.
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {networks.map((n) => {
            const isActive = n.id === activeNetworkId;
            const isShared = !!n.shareId;
            const isOwner = isShared && !!getOwnerSecret(n.shareId!);
            return (
            <div
              key={n.id}
              className={`px-5 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors cursor-pointer ${isActive ? "bg-[#e8f0fe]/40" : ""}`}
              onClick={() => { if (editingId !== n.id) onLoad(n); }}
            >
              {/* Name row */}
              <div className="flex items-start gap-2">
                {isActive && (
                  <div className="w-2 h-2 rounded-full bg-[#34a853] shrink-0 mt-1.5" title="Active network" />
                )}
                {editingId === n.id ? (
                  <form
                    className="flex-1 flex gap-1.5"
                    onClick={(e) => e.stopPropagation()}
                    onSubmit={(e) => { e.preventDefault(); handleRename(n.id); }}
                  >
                    <input
                      autoFocus
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 text-[13px] px-2 py-1 border border-[var(--color-border)] rounded-md focus:outline-none focus:border-[var(--color-blue)]"
                      onKeyDown={(e) => e.key === "Escape" && setEditingId(null)}
                    />
                    <button
                      type="submit"
                      className="text-[11px] text-[var(--color-blue)] font-medium px-2 py-1 hover:bg-[#e8f0fe] rounded"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <div className="flex-1 flex items-center gap-1.5">
                    <p className="text-[13px] font-medium text-[var(--color-fg)]">
                      {n.name}
                    </p>
                    {isShared && (
                      <span
                        className="inline-flex items-center gap-0.5 text-[10px] font-medium text-[#1a73e8] bg-[#e8f0fe] px-1.5 py-0.5 rounded-full"
                        title={`Shared ${n.sharedAt ? new Date(n.sharedAt).toLocaleDateString() : ""}`}
                      >
                        <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
                          <path d="M13.5 1a1.5 1.5 0 100 3 1.5 1.5 0 000-3zM11 2.5a2.5 2.5 0 11.603 1.628l-6.718 3.12a2.499 2.499 0 010 1.504l6.718 3.12a2.5 2.5 0 11-.488.876l-6.718-3.12a2.5 2.5 0 110-3.256l6.718-3.12A2.5 2.5 0 0111 2.5zm-8.5 4a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm11 5.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3z"/>
                        </svg>
                        Shared
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="flex items-center gap-3 mt-1.5">
                <span className="text-[11px] text-[var(--color-secondary)]">
                  {n.stations.length} stations
                </span>
                <span className="text-[11px] text-[var(--color-secondary)]">
                  {new Date(n.savedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <div className="flex-1" />
                {/* Actions — stop propagation so clicks don't trigger onLoad */}
                {isShared ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCopyLink(n.shareId!); }}
                    className={`text-[11px] font-medium transition-colors ${
                      copiedId === n.shareId
                        ? "text-[#34a853]"
                        : "text-[#1a73e8] hover:text-[#174ea6]"
                    }`}
                    title="Copy shareable link"
                  >
                    {copiedId === n.shareId ? "Copied!" : "Copy link"}
                  </button>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleShare(n); }}
                    disabled={sharingId === n.id}
                    className="text-[11px] text-[#1a73e8] hover:text-[#174ea6] font-medium transition-colors disabled:opacity-50"
                    title="Publish and get a shareable link"
                  >
                    {sharingId === n.id ? "Sharing..." : "Share"}
                  </button>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setEditingId(n.id); setEditName(n.name); }}
                  className="text-[11px] text-[var(--color-secondary)] hover:text-[var(--color-fg)] transition-colors"
                  title="Rename"
                >
                  Rename
                </button>
                {confirmDeleteId === n.id ? (
                  <span className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="text-[11px] text-red-600 font-medium hover:text-red-700"
                    >
                      Confirm
                    </button>
                    <button
                      onClick={() => setConfirmDeleteId(null)}
                      className="text-[11px] text-[var(--color-secondary)] hover:text-[var(--color-fg)]"
                    >
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(n.id); }}
                    className="text-[11px] text-[var(--color-secondary)] hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    Delete
                  </button>
                )}
              </div>

              {/* Share error */}
              {shareError && sharingId === null && (
                <p className="text-[11px] text-red-600 mt-1">{shareError}</p>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
