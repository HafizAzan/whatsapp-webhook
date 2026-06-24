"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ReactNode } from "react";
import {
  AUTOMATION_NAV,
  SECTION_RAIL,
  getActiveSection,
  getPageMeta,
} from "@/lib/navigation";
import { formatChatTime } from "@/lib/format";
import { chatHashHref } from "@/lib/route-hash";
import { connectionDot, connectionLabel, useApp } from "@/contexts/AppContext";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { useHashRef } from "@/hooks/useHashRef";

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { waState, waChats } = useApp();
  const { decoded: activeChatId } = useHashRef();
  const [chatSearch, setChatSearch] = useState("");
  const [showInbox, setShowInbox] = useState(true);

  const activeSection = getActiveSection(pathname);
  const pageMeta = getPageMeta(pathname);
  const inboxActiveChatId = pathname === "/chats" ? activeChatId : null;
  const focusChat = pathname === "/chats" && !!activeChatId;

  const filteredChats = waChats.filter((chat) =>
    chat.name.toLowerCase().includes(chatSearch.toLowerCase())
  );

  return (
    <div className="app-shell flex h-screen overflow-hidden">
      {!focusChat && (
      <aside className="flex w-[68px] shrink-0 flex-col items-center border-r border-(--border) bg-(--bg-surface) py-5">
        <Link
          href="/connect"
          className="mb-8 flex h-11 w-11 items-center justify-center rounded-xl bg-linear-to-br from-violet-500 to-cyan-500 text-sm font-bold text-white shadow-lg shadow-violet-500/30"
        >
          PB
        </Link>
        <nav className="flex flex-1 flex-col gap-1">
          {SECTION_RAIL.map((rail) => {
            const isActive = activeSection === rail.section;
            return (
              <Link
                key={rail.section}
                href={rail.href}
                title={rail.label}
                className={`flex h-11 w-11 items-center justify-center rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? "bg-(--accent-dim) text-(--accent-bright) ring-1 ring-accent-soft"
                    : "text-(--text-dim) hover:bg-(--bg-hover) hover:text-(--text-muted)"
                }`}
              >
                {rail.label.slice(0, 2).toUpperCase()}
              </Link>
            );
          })}
        </nav>
      </aside>
      )}

      {!focusChat && (
      <aside className="flex w-[280px] shrink-0 flex-col border-r border-(--border) bg-(--bg-surface)">
        <div className="border-b border-(--border) p-4">
          <Link href="/connect">
            <h1 className="bg-linear-to-r from-violet-300 to-cyan-300 bg-clip-text text-lg font-bold text-transparent">
              PulseBridge
            </h1>
          </Link>
          <p className="text-xs text-(--text-dim)">Automation command center</p>
          <div className="mt-3 flex items-center gap-2 rounded-lg border border-(--border) bg-(--bg-elevated) px-3 py-2">
            <span className={`status-dot ${connectionDot(waState)}`} />
            <span className="truncate text-xs text-(--text-muted)">
              {connectionLabel(waState)}
            </span>
          </div>
          <div className="mt-2">
            <AccountSwitcher compact />
          </div>
        </div>

        {activeSection === "automation" && (
          <nav className="border-b border-(--border) p-2">
            {AUTOMATION_NAV.map((item) => {
              const isActive =
                pathname === item.href ||
                (item.href === "/chats" && pathname === "/chats");
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`nav-pill ${isActive ? "nav-pill-active" : ""}`}
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-(--bg-hover) text-[10px] font-bold text-(--accent-bright)">
                    {item.short}
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        )}

        {waState?.status === "ready" && (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 py-2">
              <span className="text-xs font-medium uppercase tracking-wider text-(--text-dim)">
                Inbox
              </span>
              <button
                type="button"
                onClick={() => setShowInbox((v) => !v)}
                className="text-xs text-(--accent-bright) hover:underline"
              >
                {showInbox ? "Hide" : "Show"}
              </button>
            </div>
            {showInbox && (
              <>
                <div className="px-3 pb-2">
                  <input
                    value={chatSearch}
                    onChange={(e) => setChatSearch(e.target.value)}
                    placeholder="Search conversations..."
                    className="input-field py-2! text-xs!"
                  />
                </div>
                <div className="flex-1 overflow-y-auto px-2 pb-2">
                  {filteredChats.length === 0 ? (
                    <p className="px-2 py-4 text-center text-xs text-(--text-dim)">
                      {chatSearch ? "No matches" : "Loading..."}
                    </p>
                  ) : (
                    filteredChats.map((chat) => (
                      <Link
                        key={chat.id}
                        href={chatHashHref(chat.id)}
                        className={`glass-card-hover mb-1.5 flex items-center gap-3 rounded-xl p-2.5 ${
                          inboxActiveChatId === chat.id
                            ? "border-accent-strong bg-(--accent-dim)"
                            : "border-transparent bg-transparent hover:bg-(--bg-hover)"
                        }`}
                      >
                        <div className="avatar-ring h-10 w-10 shrink-0 text-xs">
                          {chat.isGroup ? "G" : chat.name[0]?.toUpperCase() || "?"}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <p className="truncate text-sm font-medium text-(--text)">
                              {chat.name}
                            </p>
                            <span className="shrink-0 text-[10px] text-(--text-dim)">
                              {formatChatTime(chat.timestamp)}
                            </span>
                          </div>
                          <p className="truncate text-xs text-(--text-dim)">
                            {chat.lastMessage || "—"}
                          </p>
                        </div>
                        {chat.unreadCount > 0 && (
                          <span className="badge badge-accent px-1.5! py-0.5! text-[10px]!">
                            {chat.unreadCount}
                          </span>
                        )}
                      </Link>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {waState?.status !== "ready" && (
          <div className="flex flex-1 items-center justify-center p-6 text-center">
            <p className="text-xs leading-relaxed text-(--text-dim)">
              Conversations yahan appear hongi jab channel linked ho
            </p>
          </div>
        )}
      </aside>
      )}

      <div className="flex min-w-0 flex-1">
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {!focusChat && (
          <header className="flex shrink-0 items-center justify-between border-b border-(--border) bg-(--bg-surface)/80 px-6 py-3 backdrop-blur-md">
            <div>
              <p className="text-sm font-medium text-(--text)">{pageMeta.title}</p>
              {pageMeta.subtitle && (
                <p className="text-xs text-(--text-dim)">{pageMeta.subtitle}</p>
              )}
            </div>
          </header>
          )}
          <div
            className={
              focusChat
                ? "flex min-h-0 flex-1 flex-col overflow-hidden"
                : "flex-1 overflow-y-auto p-6 page-enter"
            }
          >
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return <AppShellInner>{children}</AppShellInner>;
}
