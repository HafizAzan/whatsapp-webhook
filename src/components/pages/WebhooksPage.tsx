"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { safeFetchJson } from "@/lib/fetch-utils";
import type { WebhookConfig, WebhookEvent } from "@/lib/types";
import { copyToClipboard } from "@/lib/format";
import { WebhookConfigModal } from "@/components/WebhookConfigModal";

export function WebhooksPage() {
  const [webhooks, setWebhooks] = useState<WebhookConfig[]>([]);
  const [events, setEvents] = useState<WebhookEvent[]>([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingWebhook, setEditingWebhook] = useState<WebhookConfig | null>(null);

  const receiveUrl = useMemo(() => {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (appUrl) return `${appUrl}/api/webhook/receive`;
    if (typeof window !== "undefined") return `${window.location.origin}/api/webhook/receive`;
    return "/api/webhook/receive";
  }, []);

  const loadData = useCallback(async () => {
    const [wh, ev] = await Promise.all([
      safeFetchJson<{ webhooks?: WebhookConfig[] }>("/api/webhooks"),
      safeFetchJson<{ events?: WebhookEvent[] }>("/api/events"),
    ]);
    if (wh) setWebhooks(wh.webhooks || []);
    if (ev) setEvents(ev.events || []);
  }, []);

  useEffect(() => {
    const tick = () => void loadData();
    const initial = window.setTimeout(tick, 0);
    return () => window.clearTimeout(initial);
  }, [loadData]);

  async function saveWebhook(
    data: Parameters<typeof WebhookConfigModal>[0]["onSave"] extends (d: infer T) => unknown
      ? T
      : never
  ) {
    if (editingWebhook) {
      await fetch(`/api/webhooks/${editingWebhook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    } else {
      await fetch("/api/webhooks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
    }
    setEditingWebhook(null);
    await loadData();
  }

  async function deleteWebhook(id: string) {
    await fetch(`/api/webhooks/${id}`, { method: "DELETE" });
    await loadData();
  }

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="section-title">Webhooks</h1>
            <p className="section-sub">
              Receive endpoint:{" "}
              <code className="rounded-lg bg-(--bg-elevated) px-2 py-0.5 text-xs text-(--cyan)">
                {receiveUrl}
              </code>
              <button
                type="button"
                onClick={() => copyToClipboard(receiveUrl)}
                className="ml-2 text-xs text-(--accent-bright) hover:underline"
              >
                Copy
              </button>
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingWebhook(null);
              setModalOpen(true);
            }}
            className="btn-primary py-2! text-xs!"
          >
            + Add Webhook
          </button>
        </div>

        {webhooks.length === 0 ? (
          <div className="glass-card flex flex-col items-center p-12 text-center">
            <p className="text-(--text-muted)">No webhooks yet</p>
            <button type="button" onClick={() => setModalOpen(true)} className="btn-primary mt-4">
              Create first webhook
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {webhooks.map((wh) => (
              <div key={wh.id} className="glass-card glass-card-hover p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-(--text)">{wh.name}</h3>
                      <span className={`badge ${wh.enabled ? "badge-success" : "badge-muted"}`}>
                        {wh.enabled ? "Active" : "Off"}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-(--text-dim)">
                      {wh.method} · {wh.direction}
                    </p>
                    <p className="mt-1 truncate text-xs text-(--text-dim)">{wh.endpoint}</p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingWebhook(wh);
                        setModalOpen(true);
                      }}
                      className="btn-secondary px-3! py-1.5! text-xs!"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteWebhook(wh.id)}
                      className="btn-danger px-3! py-1.5! text-xs!"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-(--text-dim)">
            Recent events
          </h2>
          {events.length === 0 ? (
            <p className="text-sm text-(--text-dim)">No events yet</p>
          ) : (
            <div className="space-y-2">
              {events.slice(0, 10).map((ev) => (
                <div key={ev.id} className="glass-card p-3">
                  <div className="flex justify-between text-xs text-(--text-dim)">
                    <span>{ev.method}</span>
                    <span>{new Date(ev.receivedAt).toLocaleString()}</span>
                  </div>
                  <pre className="mt-2 overflow-x-auto rounded-lg bg-(--bg-surface) p-2 text-xs text-(--text-muted)">
                    {JSON.stringify(ev.payload, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <WebhookConfigModal
        open={modalOpen}
        webhook={editingWebhook}
        defaultEndpoint={receiveUrl}
        onClose={() => {
          setModalOpen(false);
          setEditingWebhook(null);
        }}
        onSave={saveWebhook}
      />
    </>
  );
}
