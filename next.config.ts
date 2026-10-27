import type { NextConfig } from "next";

// bun:sqlite only exists in the Bun runtime; scripts run Next via `bun --bun`.
const nextConfig: NextConfig = {
  serverExternalPackages: ["bun:sqlite"],
};

export default nextConfig;
