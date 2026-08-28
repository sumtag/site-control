import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      // Default 1MB is too small for drawing/photo uploads.
      bodySizeLimit: "15mb",
    },
  },
};

export default nextConfig;
