"use client";

import { useCallback, useEffect } from "react";
import { useApp } from "@/lib/AppContext";
import { useNetwork } from "@/lib/NetworkContext";
import { reverseGeocode } from "@/lib/api";
import AppSidebar from "@/components/AppSidebar";

export default function RoutingPage() {
  const app = useApp();
  const net = useNetwork();

  // Register routing-specific map click handler
  const handleRoutingMapClick = useCallback(
    async (lngLat: { lng: number; lat: number }) => {
      try {
        const place = await reverseGeocode(lngLat.lat, lngLat.lng);
        if (!app.origin) app.setOrigin(place); else app.setDestination(place);
      } catch {
        const place = {
          label: `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`,
          lat: lngLat.lat, lng: lngLat.lng,
        };
        if (!app.origin) app.setOrigin(place); else app.setDestination(place);
      }
    },
    [app],
  );

  useEffect(() => {
    app.registerMapCallbacks({ onMapClick: handleRoutingMapClick });
    return () => app.registerMapCallbacks(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handleRoutingMapClick]);

  return <AppSidebar />;
}
