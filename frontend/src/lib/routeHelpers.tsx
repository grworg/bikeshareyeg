import {
  TrainFront,
  Bus as BusIcon,
  Bike as BikeIcon,
  Footprints,
  Timer,
} from "lucide-react";
import type { RouteLeg } from "@/lib/types";
import type { RouteModeToggle } from "@/lib/appStore";
import { cityConfig } from "@/lib/cityConfig";

export function legColor(
  leg: { mode: string; transit_color?: string | null },
  routeMode: string,
): string {
  if (leg.mode === "lrt") return leg.transit_color ? `#${leg.transit_color}` : "#7b1fa2";
  if (leg.mode === "bus") return leg.transit_color ? `#${leg.transit_color}` : "#0b8043";
  if (leg.mode === "wait") return "#d0d0d0";
  if (leg.mode === "bike" && (routeMode === "bikeshare" || routeMode === "transit_bike")) return "#1a73e8";
  if (leg.mode === "bike") return "#34a853";
  return "#646464";
}

export function legLabel(leg: RouteLeg): string {
  if (leg.mode === "lrt") return leg.transit_route || cityConfig.transit.rapidTransitLabel;
  if (leg.mode === "bus") return leg.transit_route || "Bus";
  if (leg.mode === "wait") return "Wait";
  if (leg.mode === "bike") return "Bike";
  return "Walk";
}

export function legIcon(leg: RouteLeg): React.ReactNode {
  if (leg.mode === "lrt") return <TrainFront size={12} />;
  if (leg.mode === "bus") return <BusIcon size={12} />;
  if (leg.mode === "bike") return <BikeIcon size={12} />;
  if (leg.mode === "walk") return <Footprints size={12} />;
  return <Timer size={12} />;
}

export function shortLabel(label: string): string {
  return label.split(",").slice(0, 1).join("").trim() || label;
}

export const MODE_TOGGLE_CONFIG: {
  key: RouteModeToggle;
  label: string;
  icon: React.ReactNode;
}[] = [
  { key: "walk", label: "Walk", icon: <Footprints size={13} /> },
  { key: "bikeshare", label: "Bike Share", icon: <BikeIcon size={13} /> },
  { key: "lrt", label: cityConfig.transit.rapidTransitLabel, icon: <TrainFront size={13} /> },
  { key: "bus", label: "Bus", icon: <BusIcon size={13} /> },
];
