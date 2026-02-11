import type { NextConfig } from "next";

const API_BACKEND =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // Proxy API calls to the Python backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_BACKEND}/api/:path*`,
      },
    ];
  },

  // Allow long-running optimisation requests (MCLP can take ~60 s)
  experimental: {
    proxyTimeout: 120_000, // 120 s
  },

  // Standalone output for easier deployment (smaller footprint)
  output: "standalone",
};

export default nextConfig;
