import { isDbEnabled } from "@/lib/db/config";

export function isVercelServerless(): boolean {
  return Boolean(process.env.VERCEL);
}

export function getWhatsAppDeploymentWarning(): string | null {
  if (!isVercelServerless()) return null;

  if (isDbEnabled()) {
    return (
      "Vercel + PostgreSQL mode: accounts, webhooks aur media DB mein save honge. " +
      "Pehli dafa QR scan karein — session DB mein backup hogi."
    );
  }

  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    return (
      "Vercel mode: PostgreSQL (Neon) ya Vercel Blob configure karein taake data save rahe. " +
      "Bina storage ke har cold start par dubara QR scan hoga."
    );
  }

  return (
    "Vercel mode: Pehli dafa QR scan karein. Session Blob par save hogi. " +
    "Agar kuch minute inactive rahe to dubara link ho sakta hai."
  );
}

export function getChromeSetupHint(): string {
  if (isVercelServerless()) {
    return (
      "Vercel par Chrome load nahi hua. CHROMIUM_REMOTE_EXEC_PATH env var check karein, " +
      "Vercel Pro plan (300s timeout, 3008 MB memory) use karein, phir redeploy."
    );
  }
  return "Chrome not found. Run: npm run setup:chrome — or install Google Chrome browser.";
}
