"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useAppStore } from "@/lib/appStore";
import { useNetworkStore } from "@/lib/networkStore";
import { reverseGeocode } from "@/lib/api";
import AppSidebar from "@/components/AppSidebar";

export default function RoutingWithNetwork() {
  const { id } = useParams<{ id: string }>();
  const [loadFailed, setLoadFailed] = useState(false);
  const originRef = useRef(useAppStore.getState().origin);

  useEffect(() => {
    if (!id) return;
    if (id === useNetworkStore.getState().activeNetworkId) return;
    useNetworkStore.getState().loadNetworkById(id).then((ok) => {
      if (!ok) setLoadFailed(true);
    });
  }, [id]);

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
