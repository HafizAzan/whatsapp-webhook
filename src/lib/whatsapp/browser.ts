import { existsSync } from "fs";
import path from "path";
import { getPuppeteerCacheDir } from "@/lib/data-dir";
import { isVercelServerless, getChromeSetupHint } from "@/lib/whatsapp/deployment";

process.env.PUPPETEER_CACHE_DIR = getPuppeteerCacheDir();

const WINDOWS_CHROME_PATHS = [
  path.join(process.env.LOCALAPPDATA || "", "Google", "Chrome", "Application", "chrome.exe"),
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
];

const LINUX_CHROME_PATHS = [
  "/usr/bin/google-chrome-stable",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium-browser",
  "/usr/bin/chromium",
];

export interface ChromeLaunchConfig {
  executablePath: string;
  args: string[];
}

export async function getChromeLaunchConfig(): Promise<ChromeLaunchConfig | null> {
  if (isVercelServerless()) {
    try {
      const chromiumMod = await import("@sparticuz/chromium");
      const chromium = chromiumMod.default;
      const executablePath = await chromium.executablePath();
      if (executablePath) {
        return {
          executablePath,
          args: [...chromium.args, "--disable-dev-shm-usage", "--single-process"],
        };
      }
    } catch (err) {
      console.error("Vercel chromium load failed:", err);
    }
  }

  const bundled = await tryBundledChromePath();
  if (bundled) {
    return {
      executablePath: bundled,
      args: defaultChromeArgs(),
    };
  }

  for (const chromePath of [...WINDOWS_CHROME_PATHS, ...LINUX_CHROME_PATHS]) {
    if (chromePath && existsSync(chromePath)) {
      return {
        executablePath: chromePath,
        args: defaultChromeArgs(),
      };
    }
  }

  return null;
}

export async function getChromeExecutablePath(): Promise<string | undefined> {
  const config = await getChromeLaunchConfig();
  return config?.executablePath;
}

export function getChromeNotFoundMessage(): string {
  return getChromeSetupHint();
}

async function tryBundledChromePath(): Promise<string | undefined> {
  try {
    const puppeteer = await import("puppeteer");
    const bundled = await puppeteer.default.executablePath();
    if (bundled && existsSync(bundled)) {
      return bundled;
    }
  } catch {
    // fall through
  }
  return undefined;
}

function defaultChromeArgs(): string[] {
  return [
    "--no-sandbox",
    "--disable-setuid-sandbox",
    "--disable-dev-shm-usage",
    "--disable-gpu",
  ];
}
