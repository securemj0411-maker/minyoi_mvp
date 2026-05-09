import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "media.bunjang.co.kr",
      },
    ],
  },
};

export default nextConfig;
