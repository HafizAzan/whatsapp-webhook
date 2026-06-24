"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { safeFetchJson } from "@/lib/fetch-utils";
import type { WhatsAppConnectionState } from "@/lib/whatsapp/client";

const STATUS: Record<string, { label: string; badge: string; dot: string }> = {
  disconnected: { label: "Offline", badge: "badge-muted", dot: "status-dot-off" },
  initializing: { label: "Starting...", badge: "badge-warning", dot: "status-dot-wait" },
  qr: { label: "Scan QR", badge: "badge-accent", dot: "status-dot-wait" },
  pairing: { label: "Pairing", badge: "badge-accent", dot: "status-dot-wait" },
  authenticated: { label: "Syncing...", badge: "badge-warning", dot: "status-dot-wait" },
  ready: { label: "Live", badge: "badge-success", dot: "status-dot-live" },
  error: { label: "Error", badge: "badge-muted", dot: "status-dot-off" },
};

export function WhatsAppConnect() {
  const router = useRouter();
  const [state, setState] = useState<WhatsAppConnectionState | null>(null);
  const [loading, setLoading] = useState(false);
  const [sendTo, setSendTo] = useState("");
  const [sendMessage, setSendMessage] = useState("");
  const [sendStatus, setSendStatus] = useState("");

  const fetchStatus = useCallback(async () => {
    const data = await safeFetchJson<WhatsAppConnectionState>("/api/whatsapp/status");
    if (data) setState(data);
  }, []);

  useEffect(() => {
    const tick = () => void fetchStatus();
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 2000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [fetchStatus]);

  async function handleConnect() {
    setLoading(true);
    setState({
      status: "initializing",
      connectMethod: "qr",
      qrCodeDataUrl: null,
      pairingCode: null,
      pairingPhone: null,
      phoneNumber: null,
      pushName: null,
      error: null,
    });

    try {
      await safeFetchJson("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "qr" }),
      });
    } catch {
      setState({
        status: "error",
        connectMethod: "qr",
        qrCodeDataUrl: null,
        pairingCode: null,
        pairingPhone: null,
        phoneNumber: null,
        pushName: null,
        error: "Connect failed — dev server check karein",
      });
    }

    setLoading(false);
    void fetchStatus();
    const poll = setInterval(() => void fetchStatus(), 1500);
    setTimeout(() => clearInterval(poll), 180_000);
  }

  async function handleDisconnect() {
    setLoading(true);
    const data = await safeFetchJson<WhatsAppConnectionState>("/api/whatsapp/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeSession: false }),
    });
    if (data) setState(data);
    setLoading(false);
  }

  async function handleRemoveDevice() {
    setLoading(true);
    const data = await safeFetchJson<WhatsAppConnectionState>("/api/whatsapp/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeSession: true }),
    });
    if (data) setState(data);
    setLoading(false);
    router.replace("/login");
  }

  async function handleSendTest(e: React.FormEvent) {
    e.preventDefault();
    setSendStatus("Sending...");
    const data = await safeFetchJson<{ success?: boolean; error?: string }>(
      "/api/whatsapp/send",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: sendTo, message: sendMessage }),
      }
    );
    setSendStatus(data?.success ? "Sent!" : data?.error || "Failed");
  }

  const info = state ? STATUS[state.status] : STATUS.disconnected;
  const isConnecting =
    state?.status === "initializing" ||
    state?.status === "authenticated" ||
    state?.status === "qr" ||
    state?.status === "pairing";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="section-title">Channel Link</h1>
          <p className="section-sub">WhatsApp account ko PulseBridge se connect karein</p>
        </div>
        <span className={`badge ${info.badge}`}>
          <span className={`status-dot ${info.dot}`} />
          {info.label}
        </span>
      </div>

      <div className="glass-card p-6">
        <h2 className="mb-1 font-semibold text-(--text)">Accounts</h2>
        <p className="mb-4 text-sm text-(--text-dim)">
          Saved numbers ke beech switch karein — har account ki alag session save rehti hai
        </p>
        <AccountSwitcher onSwitched={() => void fetchStatus()} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="glass-card p-6">
          {state?.status === "ready" ? (
            <div className="space-y-5">
              <div className="flex items-center gap-4 rounded-xl border border-success-soft bg-success-soft p-4">
                <div className="avatar-ring h-14 w-14 text-lg">
                  {(state.pushName || "U")[0]?.toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold text-(--text)">{state.pushName || "Connected"}</p>
                  <p className="text-sm text-(--success)">+{state.phoneNumber}</p>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={handleDisconnect}
                  disabled={loading}
                  className="btn-secondary w-full"
                >
                  {loading ? "..." : "Pause connection"}
                </button>
                <button
                  type="button"
                  onClick={handleRemoveDevice}
                  disabled={loading}
                  className="btn-danger w-full"
                >
                  {loading ? "..." : "Remove from this device"}
                </button>
              </div>
            </div>
          ) : isConnecting ? (
            <div className="space-y-5">
              {state?.status === "qr" && state.qrCodeDataUrl ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-(--text-muted)">
                    Phone → Linked Devices → Link a Device → QR scan
                  </p>
                  <div className="mx-auto inline-block rounded-2xl border border-(--border-strong) bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={state.qrCodeDataUrl} alt="QR Code" className="h-56 w-56" />
                  </div>
                  <p className="text-xs text-(--text-dim)">Auto-refresh ~20 sec</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-(--accent) border-t-transparent" />
                  <p className="text-sm text-(--text-muted)">Session initialize ho rahi hai...</p>
                </div>
              )}
              <div className="border-t border-(--border) pt-4">
                <p className="mb-3 text-center text-xs text-(--text-dim)">
                  Reload se cancel nahi hota — yahan se band karein
                </p>
                <button type="button" onClick={handleDisconnect} disabled={loading} className="btn-danger w-full">
                  {loading ? "Cancelling..." : "Cancel Session"}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="rounded-xl border border-(--border) bg-(--bg-surface) p-4">
                <p className="text-sm leading-relaxed text-(--text-muted)">
                  QR scan se apna WhatsApp account link karein. Ek baar connect hone ke baad chats,
                  messages aur automation sab yahan se control honge.
                </p>
              </div>
              <button type="button" onClick={handleConnect} disabled={loading} className="btn-primary w-full">
                {loading ? "Connecting..." : "Generate QR & Connect"}
              </button>
            </div>
          )}

          {state?.error && (
            <p className="mt-4 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-(--danger)">
              {state.error}
            </p>
          )}
        </div>

        <div className="glass-card p-6">
          <h2 className="mb-1 font-semibold text-(--text)">Quick Send</h2>
          <p className="mb-5 text-sm text-(--text-dim)">Connection test ke liye message bhejein</p>

          {state?.status !== "ready" ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-(--border) py-12 text-center">
              <div className="mb-3 text-3xl opacity-40">◎</div>
              <p className="text-sm text-(--text-dim)">Pehle channel connect karein</p>
            </div>
          ) : (
            <form onSubmit={handleSendTest} className="space-y-3">
              <input
                value={sendTo}
                onChange={(e) => setSendTo(e.target.value)}
                placeholder="923001234567"
                required
                className="input-field"
              />
              <textarea
                value={sendMessage}
                onChange={(e) => setSendMessage(e.target.value)}
                placeholder="Test message..."
                required
                rows={3}
                className="input-field resize-none"
              />
              <button type="submit" className="btn-primary w-full">
                Send Test
              </button>
              {sendStatus && (
                <p className="text-center text-sm text-(--text-muted)">{sendStatus}</p>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
