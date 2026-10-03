import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Frames are posted as base64 JPEG; raise the body limit for route handlers.
  experimental: { serverActions: { bodySizeLimit: "8mb" } },
};

export default nextConfig;
