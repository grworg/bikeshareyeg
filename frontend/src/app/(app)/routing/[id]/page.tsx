import type { Metadata } from "next";
import { fetchNetworkMeta } from "@/lib/networkMeta";
import { cityConfig } from "@/lib/cityConfig";
import RoutingWithNetwork from "./RoutingWithNetwork";

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const net = await fetchNetworkMeta(id);

  if (!net) {
    return {
      title: `Network Not Found — ${cityConfig.appName}`,
      description: "This bike-share network could not be found.",
    };
  }

  const title = `${net.name} — ${cityConfig.appName}`;
  const desc = net.description
    ? net.description.slice(0, 160)
    : `A bike-share network with ${net.station_count} stations, ${net.total_docks} docks, and ${net.total_bikes} bikes — designed for ${cityConfig.name}.`;

  const ogImageUrl = `/routing/${id}/og`;

  return {
    title,
    description: desc,
    openGraph: {
      title,
      description: desc,
      url: `/routing/${id}`,
      siteName: cityConfig.appName,
      type: "website",
      images: [
        {
          url: ogImageUrl,
          width: 1200,
          height: 630,
          alt: `${net.name} — ${net.station_count} stations across ${cityConfig.name}`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description: desc,
      images: [ogImageUrl],
    },
  };
}

export default function RoutingNetworkPage() {
  return <RoutingWithNetwork />;
}
