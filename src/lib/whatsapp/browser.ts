import { existsSync } from "fs";
import path from "path";

// Keep Puppeteer browser inside project (avoids cache path issues on Windows)
const PUPPETEER_CACHE = path.join(process.cwd(), "data", ".puppeteer");
process.env.PUPPETEER_CACHE_DIR = PUPPETEER_CACHE;

const WINDOWS_CHROME_PATHS = [
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

export async function getChromeExecutablePath(): Promise<string | undefined> {
  try {
    const puppeteer = await import("puppeteer");
    const bundled = await puppeteer.default.executablePath();
    if (bundled && existsSync(bundled)) {
      return bundled;
    }
  } catch {
    // fall through to system Chrome
  }

  for (const chromePath of WINDOWS_CHROME_PATHS) {
    if (chromePath && existsSync(chromePath)) {
      return chromePath;
    }
  }

  return undefined;
}
