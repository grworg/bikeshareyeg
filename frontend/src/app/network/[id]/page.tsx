"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import type { BikeStation, SharedNetworkResponse } from "@/lib/types";
import type { FlyToTarget } from "@/components/DeckMap";
import { getSharedNetwork, deleteSharedNetwork } from "@/lib/api";
import { getOwnerSecret, saveNetwork as saveToLocalStorage } from "@/lib/savedNetworks";

const DeckMap = dynamic(() => import("@/components/DeckMap"), { ssr: false });

type LoadState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ok"; network: SharedNetworkResponse };

export default function SharedNetworkPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [state, setState] = useState<LoadState>({ status: "loading" });
  const [flyTo, setFlyTo] = useState<FlyToTarget | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [copied, setCopied] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    if (!id) return;
    getSharedNetwork(id)
      .then((network) => {
        setState({ status: "ok", network });
        // Fly to the centroid of all stations
        const stations: BikeStation[] = network.data?.stations ?? [];
        if (stations.length > 0) {
          const avgLat = stations.reduce((s, st) => s + st.lat, 0) / stations.length;
          const avgLng = stations.reduce((s, st) => s + st.lng, 0) / stations.length;
          setFlyTo({ latitude: avgLat, longitude: avgLng, zoom: 12, _ts: Date.now() });
        }
      })
      .catch((err) => {
        setState({ status: "error", message: err instanceof Error ? err.message : "Not found" });
      });
  }, [id]);

  const ownerSecret = id ? getOwnerSecret(id) : null;
  const isOwner = !!ownerSecret;

  const handleCopyLink = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copy this link:", window.location.href);
    }
  }, []);

  const handleDelete = useCallback(async () => {
    if (!id || !ownerSecret) return;
    setDeleting(true);
    try {
      await deleteSharedNetwork(id, ownerSecret);
      router.push("/");
    } catch {
      setDeleting(false);
      setConfirmDelete(false);
    }
  }, [id, ownerSecret, router]);

  const handleLoadInDesigner = useCallback(() => {
    if (state.status !== "ok") return;
    const data = state.network.data;
    const imported = {
      ...data,
      id: crypto.randomUUID(),
      name: `${data.name ?? state.network.name} (imported)`,
      savedAt: new Date().toISOString(),
      shareId: undefined,
      sharedAt: undefined,
    };
    saveToLocalStorage(imported);
    router.push("/");
  }, [state, router]);

  // Loading state
  if (state.status === "loading") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-[13px] text-[#5f6368]">Loading shared network...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (state.status === "error") {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-[#f8f9fa]">
        <div className="text-center max-w-md px-6">
          <div className="w-16 h-16 rounded-full bg-[#fce8e6] flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#d93025" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h1 className="text-[18px] font-medium text-[#202124] mb-2">Network not found</h1>
          <p className="text-[13px] text-[#5f6368] mb-6">{state.message}</p>
          <a
            href="/"
            className="inline-flex items-center gap-2 text-[13px] font-medium text-[#1a73e8] hover:text-[#174ea6]"
          >
            Go to BikeShareYEG
          </a>
        </div>
      </div>
    );
  }

  const { network } = state;
  const stations: BikeStation[] = network.data?.stations ?? [];
  const totalDocks = stations.reduce((s, st) => s + st.capacity, 0);
  const totalBikes = stations.reduce((s, st) => s + st.bikes, 0);

  return (
    <div className="h-screen w-screen flex flex-col">
      {/* Top bar */}
      <header className="flex items-center gap-4 px-5 py-3 bg-white border-b border-[#e0e0e0] shrink-0 z-10">
        <a href="/" className="text-[13px] text-[#5f6368] hover:text-[#202124] shrink-0">
          BikeShareYEG
        </a>
        <div className="w-px h-5 bg-[#e0e0e0]" />
        <div className="flex-1 min-w-0">
          <h1 className="text-[15px] font-medium text-[#202124] truncate">
            {network.name}
          </h1>
          {network.author && (
            <p className="text-[12px] text-[#5f6368] truncate">by {network.author}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {isOwner ? (
            <span className="text-[11px] font-medium text-[#137333] bg-[#e6f4ea] px-2 py-1 rounded-full">
              Your network
            </span>
          ) : (
            <span className="text-[11px] font-medium text-[#5f6368] bg-[#f1f3f4] px-2 py-1 rounded-full">
              View only
            </span>
          )}
          <button
            onClick={handleCopyLink}
            className={`text-[12px] font-medium px-3 py-1.5 rounded-md transition-colors ${
              copied
                ? "text-[#34a853] bg-[#e6f4ea]"
                : "text-[#1a73e8] bg-[#e8f0fe] hover:bg-[#d2e3fc]"
            }`}
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
          <button
            onClick={handleLoadInDesigner}
            className="text-[12px] font-medium text-[#202124] bg-[#f1f3f4] hover:bg-[#e8eaed] px-3 py-1.5 rounded-md transition-colors"
          >
            Load in Designer
          </button>
          {isOwner && !confirmDelete && (
            <button
              onClick={() => setConfirmDelete(true)}
              className="text-[12px] text-[#5f6368] hover:text-red-600 px-2 py-1.5 rounded-md transition-colors"
              title="Delete shared network"
            >
              Delete
            </button>
          )}
          {isOwner && confirmDelete && (
            <span className="flex items-center gap-1">
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="text-[12px] text-red-600 font-medium px-2 py-1.5 hover:bg-red-50 rounded-md disabled:opacity-50"
              >
                {deleting ? "Deleting..." : "Confirm delete"}
              </button>
              <button
                onClick={() => setConfirmDelete(false)}
                className="text-[12px] text-[#5f6368] px-2 py-1.5 hover:bg-[#f1f3f4] rounded-md"
              >
                Cancel
              </button>
            </span>
          )}
        </div>
      </header>

      {/* Map + info panel */}
      <div className="flex-1 flex min-h-0">
        {/* Info panel */}
        <aside className="w-[320px] bg-white border-r border-[#e0e0e0] overflow-y-auto shrink-0">
          {/* Access banner */}
          {!bannerDismissed && (
            isOwner ? (
              <div className="px-4 py-3 bg-[#e6f4ea] border-b border-[#ceead6]">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-[#137333] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#137333]">
                      You created this network
                    </p>
                    <p className="text-[11px] text-[#137333]/80 mt-0.5 leading-relaxed">
                      You can update or delete it from this browser. Anyone with the link can view it.
                    </p>
                  </div>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="text-[#137333]/60 hover:text-[#137333] shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            ) : (
              <div className="px-4 py-3 bg-[#e8f0fe] border-b border-[#d2e3fc]">
                <div className="flex items-start gap-2.5">
                  <svg className="w-4 h-4 text-[#1967d2] shrink-0 mt-0.5" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd"/>
                  </svg>
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-[#1967d2]">
                      View-only
                    </p>
                    <p className="text-[11px] text-[#1967d2]/80 mt-0.5 leading-relaxed">
                      This network was shared with you as read-only. Only the person who created it can make changes, from the browser they used to create it.
                    </p>
                    <p className="text-[11px] text-[#1967d2]/80 mt-1.5 leading-relaxed">
                      Want to make your own version? Use <strong>Load in Designer</strong> above to create an editable copy.
                    </p>
                  </div>
                  <button
                    onClick={() => setBannerDismissed(true)}
                    className="text-[#1967d2]/60 hover:text-[#1967d2] shrink-0"
                  >
                    <svg width="14" height="14" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                    </svg>
                  </button>
                </div>
              </div>
            )
          )}

          {/* Description */}
          {network.description && (
            <div className="px-5 py-4 border-b border-[#e0e0e0]">
              <p className="text-[13px] text-[#3c4043] leading-relaxed whitespace-pre-wrap">
                {network.description}
              </p>
            </div>
          )}

          {/* Stats */}
          <div className="px-5 py-4 border-b border-[#e0e0e0]">
            <h2 className="text-[12px] font-medium text-[#5f6368] uppercase tracking-wide mb-3">
              Network stats
            </h2>
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Stations" value={stations.length} />
              <StatCard label="Total docks" value={totalDocks} />
              <StatCard label="Total bikes" value={totalBikes} />
              <StatCard label="Views" value={network.view_count} />
            </div>
          </div>

          {/* Metadata */}
          <div className="px-5 py-4 border-b border-[#e0e0e0]">
            <h2 className="text-[12px] font-medium text-[#5f6368] uppercase tracking-wide mb-3">
              Details
            </h2>
            <div className="space-y-2 text-[12px]">
              <MetaRow label="Created" value={new Date(network.created_at).toLocaleDateString(undefined, {
                year: "numeric", month: "long", day: "numeric",
              })} />
              <MetaRow label="Last updated" value={new Date(network.updated_at).toLocaleDateString(undefined, {
                year: "numeric", month: "long", day: "numeric",
              })} />
              {network.author && <MetaRow label="Author" value={network.author} />}
            </div>
          </div>

          {/* Station list */}
          <div className="px-5 py-4">
            <h2 className="text-[12px] font-medium text-[#5f6368] uppercase tracking-wide mb-3">
              Stations ({stations.length})
            </h2>
            <div className="space-y-1">
              {stations.map((st) => (
                <button
                  key={st.id}
                  className="w-full text-left px-3 py-2 rounded-md hover:bg-[#f1f3f4] transition-colors"
                  onClick={() => setFlyTo({ latitude: st.lat, longitude: st.lng, zoom: 16, _ts: Date.now() })}
                >
                  <p className="text-[12px] font-medium text-[#202124] truncate">
                    {st.name || "Unnamed station"}
                  </p>
                  <p className="text-[11px] text-[#5f6368]">
                    {st.bikes} bikes / {st.capacity} docks
                  </p>
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Map */}
        <div className="flex-1 relative">
          <DeckMap
            stations={stations}
            origin={null}
            destination={null}
            selectedRoute={null}
            flyTo={flyTo}
            designerMode={false}
          />
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-[#f8f9fa] rounded-lg px-3 py-2.5">
      <p className="text-[18px] font-medium text-[#202124]">{value.toLocaleString()}</p>
      <p className="text-[11px] text-[#5f6368]">{label}</p>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-[#5f6368] shrink-0">{label}:</span>
      <span className="text-[#202124]">{value}</span>
    </div>
  );
}
