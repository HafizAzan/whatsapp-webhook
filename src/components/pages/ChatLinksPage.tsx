"use client";

import { useState } from "react";
import { safeFetchJson } from "@/lib/fetch-utils";
import { copyToClipboard } from "@/lib/format";

export function ChatLinksPage() {
  const [chatPhone, setChatPhone] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [generatedUrl, setGeneratedUrl] = useState("");

  async function generateChatLink() {
    const data = await safeFetchJson<{ url?: string }>(
      `/api/click-to-chat?phone=${encodeURIComponent(chatPhone)}&message=${encodeURIComponent(chatMessage)}`
    );
    setGeneratedUrl(data?.url || "");
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="section-title">Chat Links</h1>
        <p className="section-sub">WhatsApp deep link generator</p>
      </div>
      <div className="glass-card max-w-md space-y-3 p-5">
        <input
          value={chatPhone}
          onChange={(e) => setChatPhone(e.target.value)}
          placeholder="923001234567"
          className="input-field"
        />
        <textarea
          value={chatMessage}
          onChange={(e) => setChatMessage(e.target.value)}
          placeholder="Pre-filled message (optional)"
          rows={3}
          className="input-field resize-none"
        />
        <button type="button" onClick={generateChatLink} className="btn-primary w-full">
          Generate Link
        </button>
        {generatedUrl && (
          <div className="rounded-xl border border-(--border) bg-(--bg-surface) p-3">
            <a
              href={generatedUrl}
              target="_blank"
              rel="noreferrer"
              className="break-all text-sm text-(--cyan) hover:underline"
            >
              {generatedUrl}
            </a>
            <button
              type="button"
              onClick={() => copyToClipboard(generatedUrl)}
              className="mt-2 block text-xs text-(--accent-bright) hover:underline"
            >
              Copy link
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
