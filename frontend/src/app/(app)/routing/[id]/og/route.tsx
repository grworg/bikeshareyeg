import { ImageResponse } from "next/og";
import { fetchNetworkMeta } from "@/lib/networkMeta";
import { cityConfig } from "@/lib/cityConfig";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const net = await fetchNetworkMeta(id);

  if (!net) {
    return new ImageResponse(
      (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "#f8f9fa",
            fontSize: 32,
            color: "#5f6368",
          }}
        >
          Network not found
        </div>
      ),
      { width: 1200, height: 630 },
    );
  }

  const desc = net.description
    ? net.description.slice(0, 120) + (net.description.length > 120 ? "…" : "")
    : `A citizen-designed bike-share network for ${cityConfig.region}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(135deg, #0d47a1 0%, #1a73e8 40%, #4fc3f7 100%)",
          padding: "60px 64px",
          fontFamily: "sans-serif",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundImage:
              "radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)",
            backgroundSize: "32px 32px",
            display: "flex",
          }}
        />

        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              background: "rgba(255,255,255,0.2)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="5.5" cy="17.5" r="3.5" />
              <circle cx="18.5" cy="17.5" r="3.5" />
              <path d="M15 6a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm-3 11.5V14l-3-3 4-3 2 3h3" />
            </svg>
          </div>
          <span style={{ color: "rgba(255,255,255,0.85)", fontSize: 22, fontWeight: 600 }}>
            {cityConfig.appName}
          </span>
        </div>

        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: "16px" }}>
          <div
            style={{
              fontSize: 56,
              fontWeight: 700,
              color: "white",
              lineHeight: 1.15,
              textShadow: "0 2px 20px rgba(0,0,0,0.15)",
              maxWidth: "900px",
              overflow: "hidden",
              textOverflow: "ellipsis",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
            }}
          >
            {net.name}
          </div>
          {net.author && (
            <div style={{ fontSize: 22, color: "rgba(255,255,255,0.75)" }}>
              by {net.author}
            </div>
          )}
          <div style={{ fontSize: 20, color: "rgba(255,255,255,0.7)", lineHeight: 1.5, maxWidth: "800px" }}>
            {desc}
          </div>
        </div>

        <div style={{ display: "flex", gap: "40px", alignItems: "flex-end" }}>
          <StatPill label="Stations" value={net.station_count} />
          <StatPill label="Docks" value={net.total_docks} />
          <StatPill label="Bikes" value={net.total_bikes} />
          <div style={{ flex: 1 }} />
          <div
            style={{
              fontSize: 16,
              color: "rgba(255,255,255,0.5)",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            bikeshare.grassrootswork.org
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "rgba(255,255,255,0.15)",
        borderRadius: 16,
        padding: "14px 24px",
        backdropFilter: "blur(10px)",
      }}
    >
      <span style={{ fontSize: 36, fontWeight: 700, color: "white" }}>
        {value.toLocaleString()}
      </span>
      <span style={{ fontSize: 15, color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
        {label}
      </span>
    </div>
  );
}
