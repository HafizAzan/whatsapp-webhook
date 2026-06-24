"use client";

import type { ContactTag } from "@/components/ContactTagPicker";
import { ContactTagPicker } from "@/components/ContactTagPicker";
import { contactDisplayLabel } from "@/lib/contacts";
import { useApp } from "@/contexts/AppContext";
import { useState } from "react";

export interface BroadcastItem {
  id: string;
  name: string;
  contacts: string[];
  message: string;
  status: string;
}

interface BroadcastViewProps {
  broadcast: BroadcastItem;
  focusAdd?: boolean;
  onClose: () => void;
  onUpdated: () => void;
  onDeleted: () => void;
}

function contactsToTags(contacts: string[], chats: ReturnType<typeof useApp>["waChats"]): ContactTag[] {
  return contacts.map((c) => ({
    value: c,
    label: contactDisplayLabel(c, chats),
  }));
}

export function BroadcastView({
  broadcast,
  focusAdd = false,
  onClose,
  onUpdated,
  onDeleted,
}: BroadcastViewProps) {
  const { waChats } = useApp();
  const [addTags, setAddTags] = useState<ContactTag[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  const recipientTags = contactsToTags(broadcast.contacts, waChats);

  async function handleAddContacts() {
    if (addTags.length === 0) return;
    setSaving(true);
    setError("");
    const existing = new Set(broadcast.contacts);
    const merged = [...broadcast.contacts];
    for (const tag of addTags) {
      if (!existing.has(tag.value)) {
        merged.push(tag.value);
        existing.add(tag.value);
      }
    }
    const res = await fetch(`/api/broadcasts/${broadcast.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contacts: merged }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Update failed");
      return;
    }
    setAddTags([]);
    onUpdated();
  }

  async function handleDelete() {
    if (!confirm(`Delete broadcast "${broadcast.name}"?`)) return;
    setDeleting(true);
    await fetch(`/api/broadcasts/${broadcast.id}`, { method: "DELETE" });
    setDeleting(false);
    onDeleted();
  }

  return (
    <div className="flex h-full w-full max-w-md shrink-0 flex-col border-l border-(--border) bg-(--bg-surface)">
      <header className="flex items-center gap-3 border-b border-(--border) px-5 py-4">
        <button type="button" onClick={onClose} className="btn-secondary px-3! py-2!" title="Esc">
          ←
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-(--text)">{broadcast.name}</p>
          <p className="text-xs text-(--text-dim)">
            {broadcast.contacts.length} recipients · {broadcast.status}
          </p>
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="btn-danger px-3! py-2! text-xs!"
        >
          {deleting ? "…" : "Delete"}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-(--text-dim)">
            Message
          </p>
          <p className="rounded-xl border border-(--border) bg-(--bg-card) p-4 text-sm leading-relaxed text-(--text-muted)">
            {broadcast.message}
          </p>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-(--text-dim)">
            Recipients
          </p>
          <div className="flex flex-wrap gap-1.5">
            {recipientTags.map((tag) => (
              <span key={tag.value} className="badge badge-accent">
                {tag.label}
              </span>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-(--text-dim)">
            Add more people
          </p>
          <ContactTagPicker
            value={addTags}
            onChange={setAddTags}
            disabled={saving}
            placeholder="Naam search karein..."
          />
          {error && <p className="mt-2 text-sm text-(--danger)">{error}</p>}
          <button
            type="button"
            onClick={handleAddContacts}
            disabled={saving || addTags.length === 0}
            className="btn-primary mt-3 w-full"
          >
            {saving ? "Saving..." : "Add to broadcast"}
          </button>
        </div>

        {focusAdd && (
          <p className="text-xs text-(--accent-bright)">↑ Naye contacts yahan add karein</p>
        )}
      </div>
    </div>
  );
}
