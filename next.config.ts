import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["whatsapp-web.js", "puppeteer", "puppeteer-core"],
  allowedDevOrigins: ["serve-unmanned-decibel.ngrok-free.dev"],
  experimental: {
    optimizePackageImports: ["i18next", "react-i18next"],
  },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
