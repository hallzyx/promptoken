import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@0glabs/0g-ts-sdk"],
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
