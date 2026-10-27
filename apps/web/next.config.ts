import type { NextConfig } from "next";

const API_URL = process.env.API_URL ?? "http://localhost:3001";
if (!/^https?:$/.test(new URL(API_URL).protocol)) throw new Error("API_URL must be an http(s) URL");

const config: NextConfig = {
  transpilePackages: ["@insta-feed/api-client", "@insta-feed/shared"],
  // Browser-Origin-Prüfung und Umschreiben auf den API-Origin erledigt middleware.ts vor dem Rewrite.
  rewrites: async () => [{ source: "/api/:path*", destination: `${API_URL.replace(/\/+$/, "")}/:path*` }],
};

export default config;
