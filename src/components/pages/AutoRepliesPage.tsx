"use client";

import { useCallback, useEffect, useState } from "react";
import { safeFetchJson } from "@/lib/fetch-utils";

interface SmartReply {
  id: string;
  keyword: string;
  reply: string;
  enabled: boolean;
}

export function AutoRepliesPage() {
  const [smartReplies, setSmartReplies] = useState<SmartReply[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const loadData = useCallback(async () => {
    const sr = await safeFetchJson<{ replies?: SmartReply[] }>("/api/smart-replies");
    if (sr) setSmartReplies(sr.replies || []);
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

  async function addSmartReply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    const fd = new FormData(e.currentTarget);
    try {
      await fetch("/api/smart-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keyword: fd.get("keyword"), reply: fd.get("reply") }),
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
        <h1 className="section-title">Auto Replies</h1>
        <p className="section-sub">Keyword match par automatic jawab</p>
      </div>
      <form onSubmit={addSmartReply} className="glass-card flex flex-wrap gap-3 p-4">
        <input
          name="keyword"
          placeholder="Keyword"
          required
          disabled={submitting}
          className="input-field min-w-[140px] flex-1 w-auto!"
        />
        <input
          name="reply"
          placeholder="Reply message"
          required
          disabled={submitting}
          className="input-field min-w-[200px] flex-2"
        />
        <button type="submit" disabled={submitting} className="btn-primary">
          {submitting ? "Loading..." : "Add Rule"}
        </button>
      </form>
      <div className="space-y-2">
        {smartReplies.map((r) => (
          <div key={r.id} className="glass-card flex items-center justify-between p-4">
            <div className="text-sm">
              <span className="badge badge-accent">{r.keyword}</span>
              <span className="mx-2 text-(--text-dim)">→</span>
              <span className="text-(--text-muted)">{r.reply}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                await fetch(`/api/smart-replies?id=${r.id}`, { method: "DELETE" });
                loadData();
              }}
              className="btn-danger px-3! py-1.5! text-xs!"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
