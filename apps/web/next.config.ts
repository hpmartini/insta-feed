import type { NextConfig } from "next";

const config: NextConfig = {
  serverExternalPackages: ["bun:sqlite"],
  transpilePackages: ["@instafeed/shared"],
};

export default config;
