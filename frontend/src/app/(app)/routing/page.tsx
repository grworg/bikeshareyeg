"use client";

import { useEffect, useRef } from "react";
import { useAppStore } from "@/lib/appStore";
import { reverseGeocode } from "@/lib/api";
import AppSidebar from "@/components/AppSidebar";

export default function RoutingPage() {
  const originRef = useRef(useAppStore.getState().origin);

  // subscribeWithSelector: only fires when origin actually changes
  useEffect(() => {
    return useAppStore.subscribe(
      (s) => s.origin,
      (origin) => { originRef.current = origin; },
    );
  }, []);

  useEffect(() => {
    const handleClick = async (lngLat: { lng: number; lat: number }) => {
      const { setOrigin, setDestination } = useAppStore.getState();
      try {
        const place = await reverseGeocode(lngLat.lat, lngLat.lng);
        if (!originRef.current) setOrigin(place); else setDestination(place);
      } catch {
        const place = {
          label: `${lngLat.lat.toFixed(5)}, ${lngLat.lng.toFixed(5)}`,
          lat: lngLat.lat, lng: lngLat.lng,
        };
        if (!originRef.current) setOrigin(place); else setDestination(place);
      }
    };

    useAppStore.getState().registerMapCallbacks({ onMapClick: handleClick });
    return () => useAppStore.getState().registerMapCallbacks(null);
  }, []);

  return <AppSidebar />;
}
