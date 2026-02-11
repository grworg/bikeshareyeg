"use client";

import { useMemo, useRef, useState, useCallback } from "react";
import type { ElevationPoint } from "@/lib/types";

interface ElevationProfileProps {
  profile: ElevationPoint[];
  totalAscent?: number | null;
  totalDescent?: number | null;
  /** Height of the chart in pixels */
  height?: number;
  /** Accent color for the area fill */
  color?: string;
}

const PAD = { top: 4, right: 2, bottom: 16, left: 32 };

export default function ElevationProfile({
  profile,
  totalAscent,
  totalDescent,
  height = 100,
  color = "#1a73e8",
}: ElevationProfileProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{
    x: number;
    elevation: number;
    distance: number;
  } | null>(null);

  const { path, areaPath, xScale, yDomain, xDomain } = useMemo(() => {
    if (profile.length < 2)
      return { path: "", areaPath: "", xScale: () => 0, yDomain: [0, 0], xDomain: [0, 0] };

    const elevs = profile.map((p) => p.elevation_m);
    const minE = Math.min(...elevs);
    const maxE = Math.max(...elevs);
    const dists = profile.map((p) => p.distance_m);
    const maxD = Math.max(...dists);

    // Add some padding to the elevation range
    const range = maxE - minE || 10;
    const yMin = minE - range * 0.05;
    const yMax = maxE + range * 0.1;

    const chartW = 1000; // internal SVG coordinate space
    const chartH = height - PAD.top - PAD.bottom;

    const sx = (d: number) =>
      PAD.left + (maxD > 0 ? (d / maxD) * (chartW - PAD.left - PAD.right) : 0);
    const sy = (e: number) =>
      PAD.top + chartH - ((e - yMin) / (yMax - yMin)) * chartH;

    const linePoints = profile.map((p) => `${sx(p.distance_m)},${sy(p.elevation_m)}`);
    const linePath = `M${linePoints.join("L")}`;
    const area = `${linePath}L${sx(maxD)},${sy(yMin)}L${sx(0)},${sy(yMin)}Z`;

    return {
      path: linePath,
      areaPath: area,
      xScale: sx,
      yDomain: [yMin, yMax],
      xDomain: [0, maxD],
    };
  }, [profile, height]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      if (!svgRef.current || profile.length < 2) return;
      const rect = svgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const frac = (x - (PAD.left / 1000) * rect.width) / (rect.width * (1 - (PAD.left + PAD.right) / 1000));
      const clampedFrac = Math.max(0, Math.min(1, frac));
      const dist = clampedFrac * (xDomain[1] || 1);

      // Find nearest profile point
      let closest = profile[0];
      let minDiff = Infinity;
      for (const p of profile) {
        const d = Math.abs(p.distance_m - dist);
        if (d < minDiff) {
          minDiff = d;
          closest = p;
        }
      }

      setHover({
        x: (x / rect.width) * 100,
        elevation: closest.elevation_m,
        distance: closest.distance_m,
      });
    },
    [profile, xDomain],
  );

  if (profile.length < 2) return null;

  const elevRange = (yDomain[1] - yDomain[0]) || 10;

  return (
    <div className="mt-2">
      {/* Ascent/descent summary */}
      {(totalAscent != null || totalDescent != null) && (
        <div className="flex items-center gap-3 text-[11px] text-[var(--color-secondary)] mb-1">
          {totalAscent != null && (
            <span className="flex items-center gap-0.5">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M5 1L9 9H1Z" fill="#34a853" />
              </svg>
              {Math.round(totalAscent)}m
            </span>
          )}
          {totalDescent != null && (
            <span className="flex items-center gap-0.5">
              <svg width="10" height="10" viewBox="0 0 10 10">
                <path d="M5 9L9 1H1Z" fill="#ea4335" />
              </svg>
              {Math.round(totalDescent)}m
            </span>
          )}
          <span className="ml-auto text-[10px] opacity-70">
            {Math.round(yDomain[0])}–{Math.round(yDomain[1])}m elev
          </span>
        </div>
      )}

      {/* SVG chart */}
      <div
        className="relative rounded-md overflow-hidden bg-[#f8f9fa] border border-[var(--color-border)]"
        style={{ height }}
      >
        <svg
          ref={svgRef}
          viewBox={`0 0 1000 ${height}`}
          preserveAspectRatio="none"
          className="w-full h-full"
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setHover(null)}
        >
          {/* Area fill */}
          <path d={areaPath} fill={color} opacity={0.12} />
          {/* Line */}
          <path
            d={path}
            fill="none"
            stroke={color}
            strokeWidth={2.5}
            vectorEffect="non-scaling-stroke"
          />

          {/* Y-axis labels */}
          <text
            x={PAD.left - 4}
            y={PAD.top + 4}
            textAnchor="end"
            fontSize="28"
            fill="#5f6368"
          >
            {Math.round(yDomain[1])}
          </text>
          <text
            x={PAD.left - 4}
            y={height - PAD.bottom}
            textAnchor="end"
            fontSize="28"
            fill="#5f6368"
          >
            {Math.round(yDomain[0])}
          </text>

          {/* X-axis: start + end distance */}
          <text
            x={PAD.left}
            y={height - 2}
            textAnchor="start"
            fontSize="24"
            fill="#5f6368"
          >
            0
          </text>
          <text
            x={1000 - PAD.right}
            y={height - 2}
            textAnchor="end"
            fontSize="24"
            fill="#5f6368"
          >
            {xDomain[1] >= 1000
              ? `${(xDomain[1] / 1000).toFixed(1)} km`
              : `${Math.round(xDomain[1])} m`}
          </text>
        </svg>

        {/* Hover tooltip */}
        {hover && (
          <div
            className="absolute top-0 pointer-events-none"
            style={{ left: `${hover.x}%` }}
          >
            <div
              className="absolute top-0 bottom-0 w-px"
              style={{ backgroundColor: color, opacity: 0.5, height }}
            />
            <div
              className="absolute top-1 -translate-x-1/2 bg-white px-2 py-0.5 rounded shadow text-[10px] font-medium whitespace-nowrap"
              style={{ color: "#202124" }}
            >
              {Math.round(hover.elevation)}m ·{" "}
              {hover.distance >= 1000
                ? `${(hover.distance / 1000).toFixed(1)} km`
                : `${Math.round(hover.distance)} m`}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
