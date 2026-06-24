import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "whatsapp-web.js",
    "puppeteer",
    "puppeteer-core",
    "@sparticuz/chromium",
    "@neondatabase/serverless",
    "@vercel/blob",
  ],
  experimental: {
    optimizePackageImports: ["i18next", "react-i18next"],
  },
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
