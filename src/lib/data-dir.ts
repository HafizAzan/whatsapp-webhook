import path from "path";

/** Vercel serverless only allows writes under /tmp — local dev uses ./data */
export function getDataDir(): string {
  if (process.env.PULSEBRIDGE_DATA_DIR) {
    return process.env.PULSEBRIDGE_DATA_DIR;
  }
  if (process.env.VERCEL) {
    return path.join("/tmp", "pulsebridge-data");
  }
  return path.join(/* turbopackIgnore: true */ process.cwd(), "data");
}

export function getPuppeteerCacheDir(): string {
  if (process.env.VERCEL) {
    return path.join("/tmp", "pulsebridge-puppeteer");
  }
  return path.join(getDataDir(), ".puppeteer");
}
