"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safeFetchJson } from "@/lib/fetch-utils";
import type { WhatsAppMessageItem } from "@/lib/whatsapp/client";
import { MessageTicks } from "./MessageTicks";
import { ChatMessageMedia } from "./ChatMessageMedia";
import { SavedViewOncePanel } from "./SavedViewOncePanel";

interface ChatViewProps {
  chatId: string;
  chatName: string;
  isGroup: boolean;
  onClose: () => void;
}

const PAGE_SIZE = 30;

function formatMessageTime(ts: number) {
  if (!ts) return "";
  return new Date(ts * 1000).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function mergeMessages(
  existing: WhatsAppMessageItem[],
  incoming: WhatsAppMessageItem[]
): WhatsAppMessageItem[] {
  const byId = new Map(existing.map((m) => [m.id, m]));
  for (const msg of incoming) byId.set(msg.id, msg);
  return [...byId.values()].sort((a, b) => a.timestamp - b.timestamp);
}

export function ChatView({ chatId, chatName, isGroup, onClose }: ChatViewProps) {
  const [messages, setMessages] = useState<WhatsAppMessageItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMoreOlder, setHasMoreOlder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const shouldStickToBottomRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const fetchPage = useCallback(
    async (offset: number) => {
      return safeFetchJson<{
        messages?: WhatsAppMessageItem[];
        hasMore?: boolean;
        error?: string;
      }>(
        `/api/whatsapp/messages?chatId=${encodeURIComponent(chatId)}&limit=${PAGE_SIZE}&offset=${offset}`
      );
    },
    [chatId]
  );

  const loadLatest = useCallback(async () => {
    const data = await fetchPage(0);
    if (!mountedRef.current) return;
    if (data?.messages) {
      setMessages((prev) => mergeMessages(prev, data.messages!));
      setHasMoreOlder(data.hasMore ?? false);
      setError(data.error ?? null);
    } else if (data?.error) {
      setError(data.error);
    }
    setLoading(false);
  }, [fetchPage]);

  const hasEncrypted = messages.some((m) => m.isEncrypted);

  useEffect(() => {
    if (!hasEncrypted) return;
    const timer = window.setInterval(() => {
      void loadLatest();
    }, 10_000);
    return () => window.clearInterval(timer);
  }, [hasEncrypted, loadLatest]);

  const loadOlder = useCallback(async () => {
    if (loadingOlder || !hasMoreOlder) return;

    const container = scrollRef.current;
    const prevHeight = container?.scrollHeight ?? 0;

    setLoadingOlder(true);
    const data = await fetchPage(messages.length);
    if (!mountedRef.current) return;

    if (data?.messages?.length) {
      setMessages((prev) => mergeMessages(data.messages!, prev));
      setHasMoreOlder(data.hasMore ?? false);
      setError(data.error ?? null);

      requestAnimationFrame(() => {
        if (!container) return;
        container.scrollTop = container.scrollHeight - prevHeight;
      });
    } else {
      setHasMoreOlder(false);
    }

    setLoadingOlder(false);
  }, [fetchPage, hasMoreOlder, loadingOlder, messages.length]);

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    setHasMoreOlder(false);
    shouldStickToBottomRef.current = true;
    void loadLatest();
  }, [chatId, loadLatest]);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  useEffect(() => {
    const tick = () => void loadLatest();
    const interval = window.setInterval(tick, 10_000);
    return () => window.clearInterval(interval);
  }, [loadLatest]);

  useEffect(() => {
    if (!shouldStickToBottomRef.current) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleScroll() {
    const container = scrollRef.current;
    if (!container) return;

    const nearBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight < 80;
    shouldStickToBottomRef.current = nearBottom;

    if (container.scrollTop < 80) {
      void loadOlder();
    }
  }

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim() || sending) return;

    setSending(true);
    const text = draft.trim();
    setDraft("");
    shouldStickToBottomRef.current = true;

    try {
      const res = await safeFetchJson<{ success?: boolean; error?: string }>(
        "/api/whatsapp/send",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ to: chatId, message: text }),
        }
      );

      if (!mountedRef.current) return;

      if (res?.success) {
        setError(null);
        await loadLatest();
      } else {
        setDraft(text);
        setError(res?.error || "Send failed");
      }
    } catch {
      if (mountedRef.current) {
        setDraft(text);
        setError("Send failed");
      }
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }

  return (
    <div className="flex h-full w-full flex-col bg-(--bg-surface)">
      <header className="flex items-center gap-3 border-b border-(--border) px-5 py-4">
        <button
          type="button"
          onClick={onClose}
          className="btn-secondary px-3! py-2!"
          aria-label="Back to conversations"
          title="Back to conversations (Esc)"
        >
          ←
        </button>
        <div className="avatar-ring h-10 w-10 text-sm">
          {isGroup ? "G" : chatName[0]?.toUpperCase() || "?"}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-(--text)">{chatName}</p>
          <p className="text-xs text-(--text-dim)">
            {isGroup ? "Group thread" : "Direct"} · Ghost read on
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            shouldStickToBottomRef.current = true;
            void loadLatest();
          }}
          className="btn-secondary px-3! py-1.5! text-xs!"
        >
          Sync
        </button>
      </header>

      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-5 py-5"
      >
        <SavedViewOncePanel chatId={chatId} />

        {loadingOlder && (
          <p className="mb-3 text-center text-xs text-(--text-dim)">Loading older messages...</p>
        )}

        {loading && messages.length === 0 ? (
          <p className="text-center text-sm text-(--text-dim)">Loading thread...</p>
        ) : error && messages.length === 0 ? (
          <p className="text-center text-sm text-(--danger)">{error}</p>
        ) : messages.length === 0 ? (
          <p className="text-center text-sm text-(--text-dim)">No messages yet</p>
        ) : (
          <div className="space-y-3">
            {!hasMoreOlder && messages.length > 0 && (
              <p className="text-center text-xs text-(--text-dim)">Start of conversation</p>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.fromMe ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] px-4 py-2.5 ${msg.fromMe ? "message-out" : "message-in"}`}
                >
                  {!msg.fromMe && isGroup && msg.authorName && (
                    <p className="mb-1 text-xs font-medium text-(--cyan)">{msg.authorName}</p>
                  )}
                  <ChatMessageMedia
                    msg={msg}
                    chatId={chatId}
                    onDecrypted={() => void loadLatest()}
                  />
                  <div className="mt-1.5 flex items-center justify-end gap-1">
                    <span className="text-[10px] text-(--text-dim)">
                      {formatMessageTime(msg.timestamp)}
                    </span>
                    {msg.fromMe && <MessageTicks ack={msg.ack} />}
                  </div>
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>
        )}
      </div>

      <form
        onSubmit={handleSend}
        className="flex items-center gap-2 border-t border-(--border) bg-(--bg-elevated) px-5 py-4"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Compose message..."
          className="input-field flex-1"
          disabled={sending}
        />
        <button type="submit" disabled={sending || !draft.trim()} className="btn-primary px-5!">
          {sending ? "…" : "Send"}
        </button>
      </form>
    </div>
  );
}
