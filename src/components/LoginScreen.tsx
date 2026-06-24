"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslation } from "react-i18next";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { safeFetchJson } from "@/lib/fetch-utils";
import type { WhatsAppConnectionState } from "@/lib/whatsapp/client";

type LoginMethod = "qr" | "pairing";

export function LoginScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const addingAccount = searchParams.get("add") === "1";
  const { t } = useTranslation();
  const [method, setMethod] = useState<LoginMethod>("qr");
  const [state, setState] = useState<WhatsAppConnectionState | null>(null);
  const [deploymentWarning, setDeploymentWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");

  const statusLabels = useMemo(
    () => ({
      disconnected: { label: t("status.disconnected"), badge: "badge-muted", dot: "status-dot-off" },
      initializing: { label: t("status.initializing"), badge: "badge-warning", dot: "status-dot-wait" },
      qr: { label: t("status.qr"), badge: "badge-accent", dot: "status-dot-wait" },
      pairing: { label: t("status.pairing"), badge: "badge-accent", dot: "status-dot-wait" },
      authenticated: { label: t("status.authenticated"), badge: "badge-warning", dot: "status-dot-wait" },
      ready: { label: t("status.ready"), badge: "badge-success", dot: "status-dot-live" },
      error: { label: t("status.error"), badge: "badge-muted", dot: "status-dot-off" },
    }),
    [t],
  );

  const fetchStatus = useCallback(async () => {
    const data = await safeFetchJson<
      WhatsAppConnectionState & { deploymentWarning?: string | null }
    >("/api/whatsapp/status");
    if (data) {
      setState(data);
      setDeploymentWarning(data.deploymentWarning ?? null);
    }
    return data;
  }, []);

  useEffect(() => {
    if (!addingAccount) return;
    void safeFetchJson("/api/whatsapp/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeSession: false }),
    });
  }, [addingAccount]);

  useEffect(() => {
    const tick = () => void fetchStatus();
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 2000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [fetchStatus]);

  useEffect(() => {
    if (state?.status === "ready" && !addingAccount) {
      router.replace("/chats");
    }
  }, [state?.status, router, addingAccount]);

  async function handleConnectQr() {
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
        error: t("errors.connectFailed"),
      });
    }

    setLoading(false);
    void fetchStatus();
  }

  async function handleConnectPairing(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;

    setLoading(true);
    setState({
      status: "initializing",
      connectMethod: "pairing",
      qrCodeDataUrl: null,
      pairingCode: null,
      pairingPhone: digits,
      phoneNumber: null,
      pushName: null,
      error: null,
    });

    try {
      await safeFetchJson("/api/whatsapp/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "pairing", phoneNumber: digits }),
      });
    } catch {
      setState({
        status: "error",
        connectMethod: "pairing",
        qrCodeDataUrl: null,
        pairingCode: null,
        pairingPhone: digits,
        phoneNumber: null,
        pushName: null,
        error: t("errors.pairingFailed"),
      });
    }

    setLoading(false);
    void fetchStatus();
  }

  async function handleCancel() {
    setLoading(true);
    const data = await safeFetchJson<WhatsAppConnectionState>("/api/whatsapp/disconnect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ removeSession: false }),
    });
    if (data) setState(data);
    setLoading(false);
  }

  const info = state ? statusLabels[state.status] : statusLabels.disconnected;
  const isConnecting =
    state?.status === "initializing" ||
    state?.status === "authenticated" ||
    state?.status === "qr" ||
    state?.status === "pairing";

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--bg-base) p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-cyan-500 text-lg font-bold text-white shadow-lg shadow-violet-500/30">
            PB
          </div>
          <h1 className="bg-linear-to-r from-violet-300 to-cyan-300 bg-clip-text text-2xl font-bold text-transparent">
            PulseBridge
          </h1>
          <p className="mt-1 text-sm text-(--text-dim)">{t("login.subtitle")}</p>
        </div>

        <LanguageSwitcher />

        {deploymentWarning && (
          <div className="mb-4 rounded-xl border border-danger-soft bg-danger-soft p-4 text-sm leading-relaxed text-(--warning)">
            {deploymentWarning}
          </div>
        )}

        {!isConnecting && (
          <div className="glass-card mb-4 p-4">
            <p className="mb-3 text-sm font-medium text-(--text)">
              {addingAccount ? "Naya account link karein" : "Saved accounts"}
            </p>
            <AccountSwitcher onSwitched={() => router.replace("/chats")} />
          </div>
        )}

        <div className="glass-card p-6">
          <div className="mb-5 flex items-center justify-between">
            <p className="text-sm font-medium text-(--text)">{t("login.channelLink")}</p>
            <span className={`badge ${info.badge}`}>
              <span className={`status-dot ${info.dot}`} />
              {info.label}
            </span>
          </div>

          {!isConnecting && (
            <div className="mb-5 flex rounded-xl border border-(--border) bg-(--bg-surface) p-1">
              <button
                type="button"
                onClick={() => setMethod("qr")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  method === "qr"
                    ? "bg-(--accent-dim) text-(--accent-bright)"
                    : "text-(--text-dim) hover:text-(--text-muted)"
                }`}
              >
                {t("login.qrScan")}
              </button>
              <button
                type="button"
                onClick={() => setMethod("pairing")}
                className={`flex-1 rounded-lg py-2 text-sm font-medium transition-all ${
                  method === "pairing"
                    ? "bg-(--accent-dim) text-(--accent-bright)"
                    : "text-(--text-dim) hover:text-(--text-muted)"
                }`}
              >
                {t("login.phoneCode")}
              </button>
            </div>
          )}

          {isConnecting ? (
            <div className="space-y-5">
              {state?.status === "qr" && state.qrCodeDataUrl ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-(--text-muted)">{t("login.qrInstructions")}</p>
                  <div className="mx-auto inline-block rounded-2xl border border-(--border-strong) bg-white p-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={state.qrCodeDataUrl} alt="QR Code" className="h-52 w-52" />
                  </div>
                  <p className="text-xs text-(--text-dim)">{t("login.qrRefresh")}</p>
                </div>
              ) : state?.status === "pairing" && state.pairingCode ? (
                <div className="space-y-4 text-center">
                  <p className="text-sm text-(--text-muted)">{t("login.pairingInstructions")}</p>
                  <p className="text-xs text-(--text-dim)">+{state.pairingPhone}</p>
                  <div className="mx-auto inline-block rounded-2xl border border-accent-soft bg-(--accent-dim) px-8 py-5">
                    <p className="font-mono text-3xl font-bold tracking-[0.35em] text-(--accent-bright)">
                      {state.pairingCode}
                    </p>
                  </div>
                  <p className="text-xs text-(--text-dim)">{t("login.enterCodeOnPhone")}</p>
                </div>
              ) : state?.status === "authenticated" ? (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-(--accent) border-t-transparent" />
                  <p className="text-sm font-medium text-(--text-muted)">
                    {t("status.authenticated")}
                    {typeof state.syncPercent === "number" ? ` · ${state.syncPercent}%` : ""}
                  </p>
                  <p className="max-w-xs text-center text-xs leading-relaxed text-(--text-dim)">
                    QR scan ho gaya — WhatsApp sync ho raha hai. 1–2 min wait karein, phone par
                    internet ON rakhein.
                  </p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-4 py-8">
                  <div className="h-12 w-12 animate-spin rounded-full border-2 border-(--accent) border-t-transparent" />
                  <p className="text-sm text-(--text-muted)">{t("login.sessionStarting")}</p>
                </div>
              )}
              <button type="button" onClick={handleCancel} disabled={loading} className="btn-danger w-full">
                {loading ? t("login.cancelling") : t("login.cancel")}
              </button>
            </div>
          ) : method === "qr" ? (
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-(--text-muted)">{t("login.qrDescription")}</p>
              <button type="button" onClick={handleConnectQr} disabled={loading} className="btn-primary w-full">
                {loading ? t("login.starting") : t("login.generateQr")}
              </button>
            </div>
          ) : (
            <form onSubmit={handleConnectPairing} className="space-y-4">
              <p className="text-sm leading-relaxed text-(--text-muted)">{t("login.pairingDescription")}</p>
              <p className="text-xs leading-relaxed text-(--text-dim)">{t("login.pairingSessionNote")}</p>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={t("login.phonePlaceholder")}
                required
                className="input-field"
                inputMode="numeric"
              />
              <button type="submit" disabled={loading} className="btn-primary w-full">
                {loading ? t("login.sendingCode") : t("login.sendPairingCode")}
              </button>
            </form>
          )}

          {state?.error && (
            <p className="mt-4 rounded-xl border border-danger-soft bg-danger-soft p-3 text-sm text-(--danger)">
              {state.error}
            </p>
          )}
        </div>

        <p className="mt-6 text-center text-xs text-(--text-dim)">{t("login.footer")}</p>
      </div>
    </div>
  );
}
