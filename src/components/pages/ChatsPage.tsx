"use client";

import Link from "next/link";
import { useApp } from "@/contexts/AppContext";
import { ChatView } from "@/components/ChatView";
import { formatChatTime } from "@/lib/format";
import { chatHashHref } from "@/lib/route-hash";
import { useHashRef } from "@/hooks/useHashRef";

export function ChatsPage() {
  const { waState, waChats, getChatById } = useApp();
  const { decoded: chatId, clearRef } = useHashRef();

  const activeChat = chatId ? getChatById(chatId) : null;

  if (waState?.status !== "ready") {
    return (
      <div className="glass-card flex flex-col items-center justify-center p-16 text-center">
        <p className="text-(--text-muted)">
          Pehle{" "}
          <Link href="/connect" className="text-(--accent-bright) hover:underline">
            Channel Link
          </Link>{" "}
          karein
        </p>
      </div>
    );
  }

  if (chatId) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <ChatView
          key={chatId}
          chatId={chatId}
          chatName={activeChat?.name ?? "Conversation"}
          isGroup={activeChat?.isGroup ?? false}
          onClose={clearRef}
        />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="section-title">Conversations</h1>
        <p className="section-sub">Connected account ki saari threads</p>
      </div>
      <div className="glass-card overflow-hidden">
        <div className="border-b border-(--border) px-4 py-3 text-xs font-medium uppercase tracking-wider text-(--text-dim)">
          {waChats.length} threads
        </div>
        <div className="max-h-[65vh] overflow-y-auto">
          {waChats.map((chat) => (
            <Link
              key={chat.id}
              href={chatHashHref(chat.id)}
              className="glass-card-hover flex items-center gap-4 border-b border-(--border) px-4 py-3.5 last:border-0"
            >
              <div className="avatar-ring h-11 w-11 text-sm">
                {chat.isGroup ? "G" : chat.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-(--text)">{chat.name}</p>
                <p className="truncate text-sm text-(--text-dim)">
                  {chat.lastMessage || "—"}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs text-(--text-dim)">{formatChatTime(chat.timestamp)}</p>
                {chat.unreadCount > 0 && (
                  <span className="badge badge-accent mt-1">{chat.unreadCount} new</span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
