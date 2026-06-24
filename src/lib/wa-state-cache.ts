import type { WhatsAppConnectionState } from "@/lib/whatsapp/client";

const STORAGE_KEY = "pb-wa-state";

export function readCachedWaState(): WhatsAppConnectionState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WhatsAppConnectionState;
  } catch {
    return null;
  }
}

export function writeCachedWaState(state: WhatsAppConnectionState | null) {
  if (typeof window === "undefined") return;
  try {
    if (!state) {
      sessionStorage.removeItem(STORAGE_KEY);
      return;
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore quota / private mode
  }
}
