import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.bunjang.co.kr",
      },
      {
        protocol: "https",
        hostname: "**.joongna.com",
      },
    ],
  },
};

export default nextConfig;
