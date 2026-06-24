import path from "path";
import { execSync } from "child_process";

const cacheDir = path.join(process.cwd(), "data", ".puppeteer");
process.env.PUPPETEER_CACHE_DIR = cacheDir;

console.log("Installing Chrome for Puppeteer...");
console.log("Cache:", cacheDir);

execSync("npx puppeteer browsers install chrome", {
  stdio: "inherit",
  env: { ...process.env, PUPPETEER_CACHE_DIR: cacheDir },
});

console.log("Done. Restart dev server and click Connect WhatsApp.");
