"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useNetwork } from "@/lib/NetworkContext";
import { saveNetwork } from "@/lib/savedNetworks";

export default function DesignerNewPage() {
  const router = useRouter();
  const net = useNetwork();

  useEffect(() => {
    if (net.activeNetworkId) {
      router.replace(`/designer/${net.activeNetworkId}`);
      return;
    }
    // Create a new network and redirect
    const id = crypto.randomUUID();
    const draft = {
      version: 2 as const,
      id,
      name: "Untitled Network",
      savedAt: new Date().toISOString(),
      stations: [],
      plannerConfig: net.plannerConfig,
      plannerWeights: net.plannerWeights,
      decayRadii: net.decayRadii,
      densityScales: net.densityScales,
      buildLog: [],
    };
    saveNetwork(draft);
    net.loadNetwork(draft);
    router.replace(`/designer/${id}`);
  }, [net, router]);

  return (
    <div className="h-full flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-[#1a73e8] border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
