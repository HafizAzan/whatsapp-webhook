"use client";

import { useCallback, useEffect, useState } from "react";
import { safeFetchJson } from "@/lib/fetch-utils";
import { ContactTagPicker, type ContactTag } from "@/components/ContactTagPicker";
import { BroadcastView, type BroadcastItem } from "@/components/BroadcastView";
import { contactDisplayLabel } from "@/lib/contacts";
import { useHashRef } from "@/hooks/useHashRef";
import { useApp } from "@/contexts/AppContext";

export function BroadcastsPage() {
  const { waChats } = useApp();
  const { decoded: openBroadcastId, setRef, clearRef } = useHashRef();
  const [broadcasts, setBroadcasts] = useState<BroadcastItem[]>([]);
  const [contactTags, setContactTags] = useState<ContactTag[]>([]);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focusAddOnOpen, setFocusAddOnOpen] = useState(false);

  const loadData = useCallback(async () => {
    const bc = await safeFetchJson<{ broadcasts?: BroadcastItem[] }>("/api/broadcasts");
    if (bc?.broadcasts) setBroadcasts(bc.broadcasts);
  }, []);

  useEffect(() => {
    const tick = () => void loadData();
    const initial = window.setTimeout(tick, 0);
    const interval = window.setInterval(tick, 5000);
    const onFocus = () => tick();
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(initial);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [loadData]);

  const selectedBroadcast = openBroadcastId
    ? broadcasts.find((b) => b.id === openBroadcastId) ?? null
    : null;

  async function addBroadcast(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");

    if (contactTags.length === 0) {
      setFormError("Kam az kam ek contact select karein");
      return;
    }

    setSubmitting(true);
    const fd = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/broadcasts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fd.get("name"),
          contacts: contactTags.map((t) => t.value),
          message: fd.get("message"),
        }),
      });

      if (!res.ok) {
        setFormError("Create failed — dubara try karein");
        return;
      }

      const data = await res.json();
      e.currentTarget.reset();
      setContactTags([]);
      await loadData();
      if (data.broadcast?.id) {
        setRef(data.broadcast.id);
      }
    } catch {
      setFormError("Network error");
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteBroadcast(id: string) {
    await fetch(`/api/broadcasts/${id}`, { method: "DELETE" });
    if (openBroadcastId === id) clearRef();
    await loadData();
  }

  function openBroadcast(id: string, focusAdd = false) {
    setFocusAddOnOpen(focusAdd);
    setRef(id);
  }

  return (
    <div className="-m-6 flex min-h-[calc(100vh-4rem)]">
      <div
        className={`flex-1 overflow-y-auto p-6 ${selectedBroadcast ? "hidden lg:block lg:max-w-lg lg:border-r lg:border-(--border)" : ""}`}
      >
        <div className="space-y-5">
          <div>
            <h1 className="section-title">Broadcasts</h1>
            <p className="section-sub">Ek message multiple contacts ko</p>
          </div>

          <form onSubmit={addBroadcast} className="glass-card max-w-lg space-y-3 p-4">
            <input
              name="name"
              placeholder="Campaign name"
              required
              disabled={submitting}
              className="input-field"
            />

            <div>
              <label className="mb-1.5 block text-xs font-medium uppercase tracking-wide text-(--text-dim)">
                Recipients
              </label>
              <ContactTagPicker
                value={contactTags}
                onChange={setContactTags}
                disabled={submitting}
                placeholder="Naam ya number — API chats se select karein"
              />
            </div>

            <textarea
              name="message"
              placeholder="Broadcast message"
              required
              rows={3}
              disabled={submitting}
              className="input-field resize-none"
            />

            {formError && <p className="text-sm text-(--danger)">{formError}</p>}

            <button type="submit" disabled={submitting} className="btn-primary w-full">
              {submitting ? "Loading..." : "Create Broadcast"}
            </button>
          </form>

          <div className="space-y-2">
            {broadcasts.map((b) => (
              <div
                key={b.id}
                role="button"
                tabIndex={0}
                onClick={() => openBroadcast(b.id)}
                onKeyDown={(e) => e.key === "Enter" && openBroadcast(b.id)}
                className={`group glass-card glass-card-hover relative cursor-pointer p-4 ${
                  openBroadcastId === b.id ? "ring-1 ring-accent-panel" : ""
                }`}
              >
                <div className="absolute right-3 top-3 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                  <button
                    type="button"
                    title="Add people"
                    onClick={(e) => {
                      e.stopPropagation();
                      openBroadcast(b.id, true);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-(--border) bg-(--bg-elevated) text-(--accent-bright) hover:bg-(--accent-dim)"
                  >
                    +
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      void deleteBroadcast(b.id);
                    }}
                    className="flex h-8 w-8 items-center justify-center rounded-lg border border-danger-soft bg-(--bg-elevated) text-(--danger) hover-bg-danger-soft"
                  >
                    ×
                  </button>
                </div>

                <p className="pr-20 font-medium text-(--text)">{b.name}</p>
                <p className="text-sm text-(--text-dim)">{b.contacts.length} recipients</p>
                <p className="mt-2 flex flex-wrap gap-1.5">
                  {b.contacts.slice(0, 6).map((c) => (
                    <span key={c} className="badge badge-muted">
                      {contactDisplayLabel(c, waChats)}
                    </span>
                  ))}
                  {b.contacts.length > 6 && (
                    <span className="badge badge-muted">+{b.contacts.length - 6}</span>
                  )}
                </p>
                <p className="mt-2 line-clamp-2 text-sm text-(--text-muted)">{b.message}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedBroadcast && (
        <BroadcastView
          broadcast={selectedBroadcast}
          focusAdd={focusAddOnOpen}
          onClose={() => {
            clearRef();
            setFocusAddOnOpen(false);
          }}
          onUpdated={() => void loadData()}
          onDeleted={() => {
            clearRef();
            setFocusAddOnOpen(false);
            void loadData();
          }}
        />
      )}
    </div>
  );
}
