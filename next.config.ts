import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow docxtemplater and pizzip to run server-side
  serverExternalPackages: ["docxtemplater", "pizzip"],
};

export default nextConfig;
