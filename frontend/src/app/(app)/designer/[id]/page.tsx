"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/appStore";
import { useNetworkStore } from "@/lib/networkStore";
import AppSidebar from "@/components/AppSidebar";

export default function DesignerPage() {
  const { id } = useParams<{ id: string }>();
  const activeNetworkId = useNetworkStore((s) => s.activeNetworkId);
  const [loadFailed, setLoadFailed] = useState(false);

  // Load network by ID if not already the active one
  useEffect(() => {
    if (!id) return;
    if (id === useNetworkStore.getState().activeNetworkId) return;
    useNetworkStore.getState().loadNetworkById(id).then((ok) => {
      if (!ok) setLoadFailed(true);
    });
  }, [id]);

  // Register designer-specific map click handlers (stable — no deps)
  useEffect(() => {
    useAppStore.getState().registerMapCallbacks({
      onMapClick: () => {
        useAppStore.getState().setSelectedStationId(null);
        useAppStore.getState().setContextMenu(null);
      },
      onRightClick: (info) => {
        useAppStore.getState().setContextMenu({
          x: info.screenX, y: info.screenY,
          lng: info.lng, lat: info.lat,
        });
      },
    });
    return () => useAppStore.getState().registerMapCallbacks(null);
  }, []);

  if (loadFailed) {
    return (
      <div className="h-full flex flex-col items-center justify-center px-6 text-center">
        <p className="text-[14px] font-medium text-[var(--color-fg)] mb-2">Network not found</p>
        <p className="text-[12px] text-[var(--color-secondary)]">
          This network may have been deleted or the link is invalid.
        </p>
      </div>
    );
  }

  return <AppSidebar />;
}
