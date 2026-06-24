"use client";

import { useEffect } from "react";
import type { PayloadField, WebhookConfig, WebhookMethod, WebhookDirection } from "@/lib/types";
import { ALL_PAYLOAD_FIELDS, PAYLOAD_FIELD_LABELS } from "@/lib/types";

interface WebhookConfigModalProps {
  open: boolean;
  webhook?: WebhookConfig | null;
  defaultEndpoint: string;
  onClose: () => void;
  onSave: (data: {
    name: string;
    direction: WebhookDirection;
    method: WebhookMethod;
    endpoint: string;
    payloadFields: PayloadField[];
    enabled: boolean;
  }) => Promise<void>;
}

export function WebhookConfigModal({
  open,
  webhook,
  defaultEndpoint,
  onClose,
  onSave,
}: WebhookConfigModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const payloadFields = ALL_PAYLOAD_FIELDS.filter((f) => form.get(f) === "on");

    await onSave({
      name: (form.get("name") as string) || "Webhook",
      direction: form.get("direction") as WebhookDirection,
      method: form.get("method") as WebhookMethod,
      endpoint: (form.get("endpoint") as string) || defaultEndpoint,
      payloadFields,
      enabled: form.get("enabled") === "on",
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
      <div className="glass-card w-full max-w-lg overflow-hidden">
        <div className="border-b border-(--border) px-6 py-4">
          <h2 className="text-lg font-semibold text-(--text)">Webhook Setup</h2>
          <p className="mt-0.5 text-sm text-(--text-dim)">Automation endpoint configure karein</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5">
          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-(--text-dim)">
              Name
            </label>
            <input
              name="name"
              defaultValue={webhook?.name || "My Webhook"}
              className="input-field"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-(--text-dim)">
                Direction
              </label>
              <select
                name="direction"
                defaultValue={webhook?.direction || "outgoing"}
                className="input-field"
              >
                <option value="outgoing">Outgoing</option>
                <option value="incoming">Incoming</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-(--text-dim)">
                Method
              </label>
              <select name="method" defaultValue={webhook?.method || "GET"} className="input-field">
                <option value="GET">GET</option>
                <option value="POST">POST</option>
                <option value="PUT">PUT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-(--text-dim)">
              Endpoint URL
            </label>
            <input
              name="endpoint"
              type="url"
              placeholder="https://example.com/webhook"
              defaultValue={webhook?.endpoint || defaultEndpoint}
              className="input-field"
            />
          </div>

          <div>
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-(--text-dim)">
              Payload fields
            </p>
            <div className="space-y-2 rounded-xl border border-(--border) bg-(--bg-surface) p-3">
              {ALL_PAYLOAD_FIELDS.map((field) => (
                <label
                  key={field}
                  className="flex cursor-pointer items-center gap-2.5 text-sm text-(--text-muted)"
                >
                  <input
                    type="checkbox"
                    name={field}
                    defaultChecked={webhook?.payloadFields.includes(field) ?? true}
                    className="h-4 w-4 rounded border-(--border-strong) accent-(--accent)"
                  />
                  {PAYLOAD_FIELD_LABELS[field]}
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2.5 text-sm text-(--text-muted)">
            <input
              type="checkbox"
              name="enabled"
              defaultChecked={webhook?.enabled ?? true}
              className="h-4 w-4 rounded accent-(--accent)"
            />
            Enable webhook
          </label>

          <div className="flex justify-end gap-3 border-t border-(--border) pt-4">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn-primary">
              Save
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
