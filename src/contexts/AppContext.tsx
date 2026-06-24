"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { safeFetchJson } from "@/lib/fetch-utils";
import { readCachedWaState, writeCachedWaState } from "@/lib/wa-state-cache";
import type { WhatsAppConnectionState, WhatsAppChatItem } from "@/lib/whatsapp/client";

interface AppContextValue {
  waState: WhatsAppConnectionState | null;
  statusLoaded: boolean;
  waChats: WhatsAppChatItem[];
  refreshStatus: () => Promise<void>;
  refreshChats: () => Promise<void>;
  getChatById: (id: string) => WhatsAppChatItem | undefined;
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [waState, setWaState] = useState<WhatsAppConnectionState | null>(null);
  const [statusLoaded, setStatusLoaded] = useState(false);
  const [waChats, setWaChats] = useState<WhatsAppChatItem[]>([]);

  useLayoutEffect(() => {
    const cached = readCachedWaState();
    if (cached) setWaState(cached);
  }, []);

  const refreshStatus = useCallback(async () => {
    const data = await safeFetchJson<WhatsAppConnectionState>("/api/whatsapp/status");
    if (data) {
      writeCachedWaState(data);
      setWaState(data);
    }
    setStatusLoaded(true);
  }, []);

  const refreshChats = useCallback(async () => {
    const data = await safeFetchJson<{ chats?: WhatsAppChatItem[] }>("/api/whatsapp/chats");
    if (data?.chats) setWaChats(data.chats);
  }, []);

  useEffect(() => {
    const tick = () => void refreshStatus();
    tick();
    const interval = window.setInterval(tick, 3000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [refreshStatus]);

  useEffect(() => {
    if (waState?.status !== "ready") {
      setWaChats([]);
      return;
    }

    const tick = () => void refreshChats();
    tick();
    const interval = window.setInterval(tick, 10_000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [waState?.status, refreshChats]);

  const visibleChats = useMemo(
    () => (waState?.status === "ready" ? waChats : []),
    [waState?.status, waChats]
  );

  const getChatById = useCallback(
    (id: string) => visibleChats.find((c) => c.id === id),
    [visibleChats]
  );

  const value = useMemo(
    () => ({
      waState,
      statusLoaded,
      waChats: visibleChats,
      refreshStatus,
      refreshChats,
      getChatById,
    }),
    [waState, statusLoaded, visibleChats, refreshStatus, refreshChats, getChatById]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}

export function connectionLabel(state: WhatsAppConnectionState | null) {
  if (!state) return "Offline";
  if (state.status === "ready") return `+${state.phoneNumber}`;
  if (state.status === "qr") return "Awaiting QR scan";
  if (state.status === "pairing") return "Awaiting pairing code";
  if (state.status === "initializing" || state.status === "authenticated") return "Connecting...";
  return "Offline";
}

export function connectionDot(state: WhatsAppConnectionState | null) {
  if (state?.status === "ready") return "status-dot-live";
  if (state?.status === "qr" || state?.status === "pairing" || state?.status === "initializing") {
    return "status-dot-wait";
  }
  return "status-dot-off";
}
