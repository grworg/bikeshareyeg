"use client";

import { useCallback, useEffect, useState } from "react";
import type { SavedNetwork } from "@/lib/types";
import {
  listSavedNetworks,
  deleteSavedNetwork,
  renameSavedNetwork,
} from "@/lib/savedNetworks";

interface SavedNetworksListProps {
  onLoad: (network: SavedNetwork) => void;
}

export default function SavedNetworksList({ onLoad }: SavedNetworksListProps) {
  const [networks, setNetworks] = useState<SavedNetwork[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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
          {networks.map((n) => (
            <div
              key={n.id}
              className="px-5 py-3 border-b border-[var(--color-border)] hover:bg-[var(--color-surface-hover)] transition-colors"
            >
              {/* Name row */}
              <div className="flex items-start gap-2">
                {editingId === n.id ? (
                  <form
                    className="flex-1 flex gap-1.5"
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
                  <button
                    onClick={() => onLoad(n)}
                    className="flex-1 text-left group"
                  >
                    <p className="text-[13px] font-medium text-[var(--color-fg)] group-hover:text-[var(--color-blue)] transition-colors">
                      {n.name}
                    </p>
                  </button>
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
                {/* Actions */}
                <button
                  onClick={() => { setEditingId(n.id); setEditName(n.name); }}
                  className="text-[11px] text-[var(--color-secondary)] hover:text-[var(--color-fg)] transition-colors"
                  title="Rename"
                >
                  Rename
                </button>
                {confirmDeleteId === n.id ? (
                  <span className="flex items-center gap-1">
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
                    onClick={() => setConfirmDeleteId(n.id)}
                    className="text-[11px] text-[var(--color-secondary)] hover:text-red-600 transition-colors"
                    title="Delete"
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
