import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow docxtemplater and pizzip to run server-side
  serverExternalPackages: ["docxtemplater", "pizzip"],
  async headers() {
    return [
      {
        // Browsers must always check for a new service worker, or a fix to it
        // would only reach phones after the HTTP cache expires.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
