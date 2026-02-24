"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useApp } from "@/lib/AppContext";
import { useNetwork } from "@/lib/NetworkContext";
import AppSidebar from "@/components/AppSidebar";

export default function DesignerPage() {
  const { id } = useParams<{ id: string }>();
  const app = useApp();
  const net = useNetwork();
  const [loadFailed, setLoadFailed] = useState(false);

  // Load network by ID if not already the active one
  useEffect(() => {
    if (!id) return;
    if (id === net.activeNetworkId) return;
    net.loadNetworkById(id).then((ok) => {
      if (!ok) setLoadFailed(true);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Register designer-specific map click handlers
  const handleDesignerMapClick = useCallback(() => {
    app.setSelectedStationId(null);
    app.setContextMenu(null);
  }, [app]);

  const handleRightClick = useCallback(
    (info: { screenX: number; screenY: number; lng: number; lat: number }) => {
      app.setContextMenu({ x: info.screenX, y: info.screenY, lng: info.lng, lat: info.lat });
    },
    [app],
  );

  useEffect(() => {
    app.registerMapCallbacks({
      onMapClick: handleDesignerMapClick,
      onRightClick: handleRightClick,
    });
    return () => app.registerMapCallbacks(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleDesignerMapClick, handleRightClick]);

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
