"use client";

import { useCallback, useEffect, useState } from "react";
import { safeFetchJson } from "@/lib/fetch-utils";

interface ScheduledMessage {
  id: string;
  phone: string;
  message: string;
  scheduledAt: string;
  status: string;
}

export function ScheduledPage() {
  const [scheduled, setScheduled] = useState<ScheduledMessage[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const sc = await safeFetchJson<{ messages?: ScheduledMessage[] }>("/api/scheduled-messages");
    if (sc) setScheduled(sc.messages || []);
  }, []);

  useEffect(() => {
    const tick = () => void loadData();
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 8000);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
    };
  }, [loadData]);

  async function addScheduled(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await fetch("/api/scheduled-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: fd.get("phone"),
          message: fd.get("message"),
          scheduledAt: fd.get("scheduledAt"),
        }),
      });
      e.currentTarget.reset();
      await loadData();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="section-title">Scheduler</h1>
        <p className="section-sub">Messages ko time par queue karein</p>
      </div>
      <form onSubmit={addScheduled} className="glass-card max-w-lg space-y-3 p-4">
        <input name="phone" placeholder="923001234567" required disabled={submitting} className="input-field" />
        <textarea
          name="message"
          placeholder="Message"
          required
          rows={3}
          disabled={submitting}
          className="input-field resize-none"
        />
        <input name="scheduledAt" type="datetime-local" required disabled={submitting} className="input-field" />
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Loading..." : "Schedule"}
        </button>
      </form>
      <div className="space-y-2">
        {scheduled.map((m) => (
          <div key={m.id} className="glass-card p-4">
            <p className="font-medium text-(--text)">{m.phone}</p>
            <p className="text-sm text-(--text-muted)">{m.message}</p>
            <p className="mt-1 text-xs text-(--text-dim)">
              {new Date(m.scheduledAt).toLocaleString()} · {m.status}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
