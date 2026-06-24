"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { WhatsAppMessageItem } from "@/lib/whatsapp/client";
import { decryptMessagePreview } from "@/lib/whatsapp/decrypt-preview";
import {
  MessagePreviewModal,
  type MessagePreviewData,
} from "@/components/MessagePreviewModal";

interface ChatMessageMediaProps {
  msg: WhatsAppMessageItem;
  chatId: string;
  onDecrypted?: () => void;
}

function buildFetchUrl(chatId: string, messageId: string, force = false) {
  const params = new URLSearchParams({ chatId, messageId });
  if (force) params.set("force", "1");
  return `/api/whatsapp/media/fetch?${params.toString()}`;
}

function ViewOnceTapCard({
  label,
  hint,
  onClick,
  busy,
}: {
  label: string;
  hint: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-xl border border-dashed border-(--warning) bg-danger-soft p-4 text-left transition hover:bg-(--bg-hover) disabled:opacity-60"
    >
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-(--bg-elevated) text-xl">
        {busy ? "…" : "👁"}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-(--warning)">{label}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-(--text-dim)">{hint}</p>
      </div>
    </button>
  );
}

export function ChatMessageMedia({ msg, chatId, onDecrypted }: ChatMessageMediaProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(Boolean(msg.hasMedia || msg.isViewOnce));
  const [failed, setFailed] = useState(false);
  const blobRef = useRef<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [modalPreview, setModalPreview] = useState<MessagePreviewData | null>(null);
  const modalBlobRef = useRef<string | null>(null);

  const isCiphertext =
    msg.type === "ciphertext" || Boolean(msg.isEncrypted && !msg.hasMedia);
  const shouldLoadMedia = (msg.hasMedia || msg.isViewOnce) && !isCiphertext;

  const setPreviewUrl = useCallback((next: string | null) => {
    if (blobRef.current) URL.revokeObjectURL(blobRef.current);
    blobRef.current = next;
    setBlobUrl(next);
  }, []);

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
    clearModalBlob();
  }, [clearModalBlob]);

  const openDecryptModal = useCallback(async () => {
    setModalOpen(true);
    setModalLoading(true);
    setModalError(null);
    setModalPreview(null);
    clearModalBlob();

    try {
      const preview = await decryptMessagePreview(chatId, msg.id);
      if (preview.blobUrl) modalBlobRef.current = preview.blobUrl;
      setModalPreview(preview);
      onDecrypted?.();
    } catch (err) {
      setModalError(err instanceof Error ? err.message : "Decrypt nahi hua");
    } finally {
      setModalLoading(false);
    }
  }, [chatId, clearModalBlob, msg.id, onDecrypted]);

  const loadMedia = useCallback(
    async (force = false) => {
      if (!shouldLoadMedia) return;

      setLoading(true);
      setFailed(false);

      try {
        let mediaPath = force ? null : msg.mediaUrl;

        if (!mediaPath) {
          const res = await fetch(buildFetchUrl(chatId, msg.id, force));
          const data = (await res.json()) as { mediaUrl?: string; error?: string };
          mediaPath = data.mediaUrl ?? null;
        }

        if (!mediaPath) {
          setFailed(true);
          return;
        }

        const mediaRes = await fetch(`${mediaPath}${mediaPath.includes("?") ? "&" : "?"}v=1`, {
          cache: "no-store",
        });

        if (!mediaRes.ok) {
          setFailed(true);
          return;
        }

        const blob = await mediaRes.blob();
        if (!blob.size) {
          setFailed(true);
          return;
        }

        setPreviewUrl(URL.createObjectURL(blob));
      } catch {
        setFailed(true);
      } finally {
        setLoading(false);
      }
    },
    [chatId, msg.id, msg.mediaUrl, setPreviewUrl, shouldLoadMedia]
  );

  useEffect(() => {
    if (!shouldLoadMedia) return;
    void loadMedia(false);
    return () => {
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current);
        blobRef.current = null;
      }
    };
  }, [loadMedia, shouldLoadMedia]);

  if (isCiphertext) {
    return (
      <>
        <ViewOnceTapCard
          label={msg.isViewOnce ? "View once" : "Encrypted message"}
          hint="Tap karein — decrypt API chalegi aur preview modal khulega"
          onClick={() => void openDecryptModal()}
          busy={modalLoading && modalOpen}
        />
        <MessagePreviewModal
          open={modalOpen}
          onClose={closeModal}
          loading={modalLoading}
          error={modalError}
          preview={modalPreview}
          onRetry={() => void openDecryptModal()}
        />
      </>
    );
  }

  if (!shouldLoadMedia) {
    return msg.body ? (
      <p className="whitespace-pre-wrap wrap-break-words text-sm leading-relaxed text-(--text)">
        {msg.body}
      </p>
    ) : null;
  }

  return (
    <>
      <div className="space-y-2">
        {(msg.isViewOnce || msg.isEncrypted) && (
          <span className="badge badge-warning text-[10px]!">
            {msg.isViewOnce ? "View once · saved copy" : "Encrypted message"}
          </span>
        )}

        {msg.isViewOnce && !blobUrl && !loading && (
          <ViewOnceTapCard
            label="View once"
            hint="Tap karein — saved copy modal mein kholo"
            onClick={() => void openDecryptModal()}
            busy={modalLoading && modalOpen}
          />
        )}

        {loading && <p className="text-xs text-(--text-dim)">Loading media...</p>}

        {failed && !blobUrl && (
          <div className="space-y-2">
            <ViewOnceTapCard
              label={msg.isViewOnce ? "View once · open nahi hua" : "Media unavailable"}
              hint="Tap karein — decrypt / download dubara try karein"
              onClick={() => void openDecryptModal()}
              busy={modalLoading && modalOpen}
            />
            <button
              type="button"
              onClick={() => void loadMedia(true)}
              className="text-xs text-(--accent-bright) hover:underline"
            >
              Retry download
            </button>
          </div>
        )}

        {blobUrl && (msg.type === "image" || msg.type === "sticker") && (
          <button type="button" onClick={() => void openDecryptModal()} className="block w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={blobUrl}
              alt={msg.body || "Image"}
              className="max-h-80 max-w-full rounded-lg object-contain"
            />
          </button>
        )}

        {blobUrl && msg.type === "video" && (
          <video src={blobUrl} controls playsInline className="max-h-80 max-w-full rounded-lg" />
        )}

        {blobUrl && (msg.type === "audio" || msg.type === "ptt") && (
          <audio src={blobUrl} controls className="w-full min-w-[220px]" />
        )}

        {blobUrl && msg.type === "document" && (
          <a
            href={blobUrl}
            download={msg.mediaFilename || "file"}
            className="inline-flex items-center gap-2 rounded-lg border border-(--border) bg-(--bg-elevated) px-3 py-2 text-sm text-(--accent-bright) hover:bg-(--bg-hover)"
          >
            Download {msg.mediaFilename || "document"}
          </a>
        )}

        {msg.body && (
          <p className="whitespace-pre-wrap wrap-break-words text-sm leading-relaxed text-(--text)">
            {msg.body}
          </p>
        )}
      </div>

      <MessagePreviewModal
        open={modalOpen}
        onClose={closeModal}
        loading={modalLoading}
        error={modalError}
        preview={modalPreview}
        onRetry={() => void openDecryptModal()}
      />
    </>
  );
}
