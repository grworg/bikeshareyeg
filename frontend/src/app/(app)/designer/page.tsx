"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNetworkStore } from "@/lib/networkStore";
import { saveNetwork } from "@/lib/savedNetworks";

export default function DesignerNewPage() {
  const router = useRouter();
  const activeNetworkId = useNetworkStore((s) => s.activeNetworkId);

  useEffect(() => {
    if (activeNetworkId) {
      router.replace(`/designer/${activeNetworkId}`);
      return;
    }
    const s = useNetworkStore.getState();
    const id = crypto.randomUUID();
    const draft = {
      version: 2 as const,
      id,
      name: "Untitled Network",
      savedAt: new Date().toISOString(),
      stations: [],
      plannerConfig: s.plannerConfig,
      plannerWeights: s.plannerWeights,
      decayRadii: s.decayRadii,
      densityScales: s.densityScales,
      buildLog: [],
    };
    saveNetwork(draft);
    s.loadNetwork(draft);
    router.replace(`/designer/${id}`);
  }, [activeNetworkId, router]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
