"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { safeFetchJson } from "@/lib/fetch-utils";
import { loadSavedMediaPreview } from "@/lib/whatsapp/decrypt-preview";
import {
  MessagePreviewModal,
  type MessagePreviewData,
} from "@/components/MessagePreviewModal";

interface SavedItem {
  id: string;
  messageType: string;
  mimeType: string;
  filename: string;
  savedAt: string;
  mediaUrl: string;
  caption?: string;
}

export function SavedViewOncePanel({ chatId }: { chatId: string }) {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalPreview, setModalPreview] = useState<MessagePreviewData | null>(null);
  const modalBlobRef = useRef<string | null>(null);
  const [activeItem, setActiveItem] = useState<SavedItem | null>(null);

  useEffect(() => {
    void (async () => {
      const data = await safeFetchJson<{ items?: SavedItem[] }>(
        `/api/whatsapp/saved-media?chatId=${encodeURIComponent(chatId)}`
      );
      if (data?.items?.length) setItems(data.items);
    })();
  }, [chatId]);

  const clearModalBlob = useCallback(() => {
    if (modalBlobRef.current) {
      URL.revokeObjectURL(modalBlobRef.current);
      modalBlobRef.current = null;
    }
  }, []);

  const closeModal = useCallback(() => {
    setModalOpen(false);
    setModalLoading(false);
    setModalError(null);
    setModalPreview(null);
    setActiveItem(null);
    clearModalBlob();
  }, [clearModalBlob]);

  const openItemPreview = useCallback(
    async (item: SavedItem) => {
      setActiveItem(item);
      setModalOpen(true);
      setModalLoading(true);
      setModalError(null);
      setModalPreview(null);
      clearModalBlob();

      try {
        const preview = await loadSavedMediaPreview(
          item.mediaUrl,
          item.messageType,
          item.caption
        );
        if (preview.blobUrl) modalBlobRef.current = preview.blobUrl;
        setModalPreview({ ...preview, isViewOnce: true });
      } catch {
        setModalError("Saved copy load nahi hui");
      } finally {
        setModalLoading(false);
      }
    },
    [clearModalBlob]
  );

  if (items.length === 0) return null;

  return (
    <>
      <div className="mb-4 rounded-xl border border-danger-soft bg-danger-soft p-3">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left text-sm font-medium text-(--warning)"
        >
          <span>View once saved ({items.length})</span>
          <span>{open ? "▲" : "▼"}</span>
        </button>

        {open && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-(--text-dim)">
              Tap karein — saved view-once modal mein khulega.
            </p>
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openItemPreview(item)}
                className="flex w-full items-center gap-3 rounded-lg border border-(--border) bg-(--bg-surface) p-3 text-left transition hover:bg-(--bg-hover)"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-(--bg-elevated) text-lg">
                  👁
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-(--text) capitalize">
                    {item.messageType}
                  </p>
                  <p className="text-xs text-(--text-dim)">
                    {new Date(item.savedAt).toLocaleString()}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      <MessagePreviewModal
        open={modalOpen}
        onClose={closeModal}
        loading={modalLoading}
        error={modalError}
        preview={modalPreview ? { ...modalPreview, isViewOnce: true } : null}
        onRetry={activeItem ? () => void openItemPreview(activeItem) : undefined}
      />
    </>
  );
}
