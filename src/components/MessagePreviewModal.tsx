"use client";

import { useEffect } from "react";

export interface MessagePreviewData {
  type: string;
  body?: string;
  blobUrl?: string;
  mediaFilename?: string | null;
  isViewOnce?: boolean;
}

interface MessagePreviewModalProps {
  open: boolean;
  onClose: () => void;
  loading: boolean;
  error: string | null;
  preview: MessagePreviewData | null;
  onRetry?: () => void;
}

function PreviewContent({ preview }: { preview: MessagePreviewData }) {
  const { type, body, blobUrl, mediaFilename } = preview;

  if (blobUrl && (type === "image" || type === "sticker")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={blobUrl}
        alt={body || "Image"}
        className="mx-auto max-h-[70vh] max-w-full rounded-lg object-contain"
      />
    );
  }

  if (blobUrl && type === "video") {
    return (
      <video
        src={blobUrl}
        controls
        playsInline
        autoPlay
        className="mx-auto max-h-[70vh] max-w-full rounded-lg"
      />
    );
  }

  if (blobUrl && (type === "audio" || type === "ptt")) {
    return <audio src={blobUrl} controls autoPlay className="w-full min-w-[280px]" />;
  }

  if (blobUrl && type === "document") {
    return (
      <a
        href={blobUrl}
        download={mediaFilename || "file"}
        className="inline-flex items-center gap-2 rounded-lg border border-(--border) bg-(--bg-elevated) px-4 py-3 text-sm text-(--accent-bright) hover:bg-(--bg-hover)"
      >
        Download {mediaFilename || "document"}
      </a>
    );
  }

  if (body && body !== "[ciphertext]") {
    return (
      <p className="whitespace-pre-wrap wrap-break-words text-base leading-relaxed text-(--text)">
        {body}
      </p>
    );
  }

  return (
    <p className="text-sm text-(--text-dim)">
      Content load nahi hua. Dubara try karein ya phone par WhatsApp check karein.
    </p>
  );
}

export function MessagePreviewModal({
  open,
  onClose,
  loading,
  error,
  preview,
  onRetry,
}: MessagePreviewModalProps) {
  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="glass-card flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Message preview"
      >
        <div className="flex items-center justify-between border-b border-(--border) px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-(--text)">
              {preview?.isViewOnce ? "View once" : "Message preview"}
            </h2>
            {preview?.type && !loading && (
              <p className="mt-0.5 text-xs text-(--text-dim) capitalize">{preview.type}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-lg text-(--text-dim) hover:bg-(--bg-hover) hover:text-(--text)"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          {loading && (
            <div className="flex flex-col items-center justify-center gap-3 py-16">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-(--accent) border-t-transparent" />
              <p className="text-sm text-(--text-dim)">Decrypt ho raha hai… (50s tak wait karein)</p>
            </div>
          )}

          {!loading && error && (
            <div className="space-y-4 py-8 text-center">
              <p className="text-sm leading-relaxed text-(--danger)">{error}</p>
              <p className="text-xs leading-relaxed text-(--text-dim)">
                Decrypt ke liye phone par WhatsApp khuli honi chahiye (internet ON). App connected
                rakho jab message aaye — view-once turant save ho sakta hai.
              </p>
              {onRetry && (
                <button type="button" onClick={onRetry} className="btn-secondary text-sm!">
                  Dubara try karein
                </button>
              )}
            </div>
          )}

          {!loading && !error && preview && <PreviewContent preview={preview} />}
        </div>
      </div>
    </div>
  );
}
