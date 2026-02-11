import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Proxy API calls to the Python backend
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:8000/api/:path*",
      },
    ];
  },

  // Allow long-running optimisation requests (MCLP can take ~60 s)
  experimental: {
    proxyTimeout: 120_000, // 120 s
  },
};

export default nextConfig;
