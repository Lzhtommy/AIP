import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Docker 部署用自包含产物（.next/standalone）
  output: "standalone",
};

export default nextConfig;
