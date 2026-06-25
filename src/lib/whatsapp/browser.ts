import { existsSync } from "fs";
import path from "path";
import { getPuppeteerCacheDir } from "@/lib/data-dir";
import { isVercelServerless, getChromeSetupHint } from "@/lib/whatsapp/deployment";

process.env.PUPPETEER_CACHE_DIR = getPuppeteerCacheDir();
process.env.PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true";
process.env.PUPPETEER_SKIP_DOWNLOAD = "true";

const DEFAULT_CHROMIUM_PACK_URL =
  "https://github.com/Sparticuz/chromium/releases/download/v149.0.0/chromium-v149.0.0-pack.x64.tar";

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
  headless?: boolean | "shell";
  defaultViewport?: { width: number; height: number } | null;
}

export async function getChromeLaunchConfig(): Promise<ChromeLaunchConfig | null> {
  if (isVercelServerless()) {
    const vercelConfig = await getVercelChromiumConfig();
    if (vercelConfig) return vercelConfig;
  }

  const localChrome = process.env.CHROMIUM_LOCAL_EXEC_PATH;
  if (localChrome && existsSync(localChrome)) {
    return {
      executablePath: localChrome,
      args: defaultChromeArgs(),
      headless: true,
    };
  }

  const bundled = await tryBundledChromePath();
  if (bundled) {
    return {
      executablePath: bundled,
      args: defaultChromeArgs(),
      headless: true,
    };
  }

  for (const chromePath of [...WINDOWS_CHROME_PATHS, ...LINUX_CHROME_PATHS]) {
    if (chromePath && existsSync(chromePath)) {
      return {
        executablePath: chromePath,
        args: defaultChromeArgs(),
        headless: true,
      };
    }
  }

  return null;
}

async function getVercelChromiumConfig(): Promise<ChromeLaunchConfig | null> {
  const remotePack =
    process.env.CHROMIUM_REMOTE_EXEC_PATH?.trim() || DEFAULT_CHROMIUM_PACK_URL;

  try {
    const chromiumMod = await import("@sparticuz/chromium-min");
    const chromium = chromiumMod.default;
    const executablePath = await chromium.executablePath(remotePack);

    if (!executablePath) {
      console.error("Vercel chromium: executablePath empty");
      return null;
    }

    process.env.PUPPETEER_EXECUTABLE_PATH = executablePath;

    return {
      executablePath,
      args: [...chromium.args, "--disable-dev-shm-usage", "--no-zygote"],
      headless: chromium.headless,
      defaultViewport: chromium.defaultViewport,
    };
  } catch (err) {
    console.error("Vercel chromium-min load failed:", err);
    return null;
  }
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
    const puppeteer = await import("puppeteer-core");
    const bundled = await puppeteer.default.executablePath();
    if (bundled && existsSync(bundled)) {
      return bundled;
    }
  } catch {
    // fall through
  }

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
