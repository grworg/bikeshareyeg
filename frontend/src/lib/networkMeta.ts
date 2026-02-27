/**
 * Server-side utility for fetching shared network metadata.
 * Used by generateMetadata() in route pages and OG image routes.
 */

const API_BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface NetworkMeta {
  id: string;
  name: string;
  description: string;
  author: string;
  station_count: number;
  created_at: string;
  updated_at: string;
  view_count: number;
  total_docks: number;
  total_bikes: number;
}

export async function fetchNetworkMeta(
  id: string,
): Promise<NetworkMeta | null> {
  try {
    const res = await fetch(`${API_BACKEND}/api/networks/${id}`, {
      next: { revalidate: 60 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const stations: { capacity: number; bikes: number }[] =
      data.data?.stations ?? [];
    return {
      id: data.id,
      name: data.name,
      description: data.description,
      author: data.author,
      station_count: data.station_count,
      created_at: data.created_at,
      updated_at: data.updated_at,
      view_count: data.view_count,
      total_docks: stations.reduce((s, st) => s + st.capacity, 0),
      total_bikes: stations.reduce((s, st) => s + st.bikes, 0),
    };
  } catch {
    return null;
  }
}
