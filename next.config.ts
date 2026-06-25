import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "whatsapp-web.js",
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium-min",
    "@neondatabase/serverless",
    "@vercel/blob",
  ],
  outputFileTracingIncludes: {
    "/api/whatsapp/connect": ["./node_modules/@sparticuz/chromium-min/**"],
    "/api/whatsapp/status": ["./node_modules/@sparticuz/chromium-min/**"],
    "/api/whatsapp/**": ["./node_modules/@sparticuz/chromium-min/**"],
  },
  experimental: {
    optimizePackageImports: ["i18next", "react-i18next"],
  },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
