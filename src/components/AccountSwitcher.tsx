"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { safeFetchJson } from "@/lib/fetch-utils";
import type { WhatsAppAccountsSnapshot } from "@/lib/whatsapp/client";

interface AccountSwitcherProps {
  compact?: boolean;
  onSwitched?: () => void;
}

export function AccountSwitcher({ compact = false, onSwitched }: AccountSwitcherProps) {
  const router = useRouter();
  const [snapshot, setSnapshot] = useState<WhatsAppAccountsSnapshot | null>(null);
  const [open, setOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const data = await safeFetchJson<WhatsAppAccountsSnapshot>("/api/whatsapp/accounts");
    if (data) setSnapshot(data);
  }, []);

  useEffect(() => {
    void load();
    const interval = window.setInterval(() => void load(), 5000);
    return () => window.clearInterval(interval);
  }, [load]);

  async function handleSwitch(accountId: string) {
    if (snapshot?.connectedAccountId === accountId) {
      setOpen(false);
      return;
    }

    setBusyId(accountId);
    setError(null);
    const state = await safeFetchJson<{ status?: string; error?: string }>(
      "/api/whatsapp/accounts/switch",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId }),
      }
    );

    setBusyId(null);

    if (state?.status === "ready") {
      setOpen(false);
      onSwitched?.();
      router.push("/chats");
      router.refresh();
      void load();
      return;
    }

    if (state?.error) {
      setError(state.error);
      return;
    }

    setError("Switch nahi hua — dubara try karein");
  }

  async function handleRemove(accountId: string) {
    if (!window.confirm(`+${accountId} is device se hata dein? Dubara link karna hoga.`)) return;
    setBusyId(accountId);
    setError(null);
    await safeFetchJson("/api/whatsapp/accounts/remove", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accountId }),
    });
    setBusyId(null);
    void load();
  }

  const accounts = snapshot?.accounts ?? [];
  const connected = snapshot?.connectedAccountId;

  if (accounts.length === 0 && !connected) {
    return compact ? null : (
      <p className="text-xs text-(--text-dim)">Koi saved account nahi — pehle link karein</p>
    );
  }

  if (compact) {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between gap-2 rounded-lg border border-(--border) bg-(--bg-elevated) px-3 py-2 text-left"
        >
          <span className="truncate text-xs text-(--text-muted)">
            {connected ? `+${connected}` : "Account switch"}
          </span>
          <span className="text-[10px] text-(--text-dim)">{open ? "▲" : "▼"}</span>
        </button>
        {open && (
          <AccountList
            accounts={accounts}
            connected={connected}
            busyId={busyId}
            error={error}
            onSwitch={handleSwitch}
            onRemove={handleRemove}
            onAdd={() => router.push("/login?add=1")}
            className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-(--border) bg-(--bg-surface) p-2 shadow-lg"
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <AccountList
        accounts={accounts}
        connected={connected}
        busyId={busyId}
        error={error}
        onSwitch={handleSwitch}
        onRemove={handleRemove}
        onAdd={() => router.push("/login?add=1")}
      />
    </div>
  );
}

function AccountList({
  accounts,
  connected,
  busyId,
  error,
  onSwitch,
  onRemove,
  onAdd,
  className = "",
}: {
  accounts: WhatsAppAccountsSnapshot["accounts"];
  connected: string | null | undefined;
  busyId: string | null;
  error: string | null;
  onSwitch: (id: string) => void;
  onRemove: (id: string) => void;
  onAdd: () => void;
  className?: string;
}) {
  return (
    <div className={`space-y-2 ${className}`}>
      {accounts.map((account) => {
        const isLive = connected === account.accountId;
        return (
          <div
            key={account.accountId}
            className={`rounded-lg border p-3 ${
              isLive ? "border-success-soft bg-success-soft" : "border-(--border) bg-(--bg-elevated)"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-(--text)">
                  {account.pushName || "WhatsApp"}
                </p>
                <p className="text-xs text-(--text-dim)">+{account.accountId}</p>
                <p className="mt-1 text-[10px] text-(--text-dim)">
                  {isLive ? "● Connected" : account.hasSession ? "○ Saved session" : "○ Re-link needed"}
                </p>
              </div>
              <div className="flex shrink-0 flex-col gap-1">
                {!isLive && (
                  <button
                    type="button"
                    disabled={busyId === account.accountId || !account.hasSession}
                    onClick={() => void onSwitch(account.accountId)}
                    className="btn-secondary px-2! py-1! text-[10px]! disabled:opacity-50"
                  >
                    {busyId === account.accountId ? "..." : "Switch"}
                  </button>
                )}
                <button
                  type="button"
                  disabled={busyId === account.accountId}
                  onClick={() => void onRemove(account.accountId)}
                  className="text-[10px] text-(--danger) hover:underline disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" onClick={onAdd} className="btn-primary w-full text-xs!">
        + Naya account link karein
      </button>
      {error && <p className="text-xs text-(--danger)">{error}</p>}
    </div>
  );
}
