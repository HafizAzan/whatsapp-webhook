import type { MessagePreviewData } from "@/components/MessagePreviewModal";

export interface DecryptApiResponse {
  ok?: boolean;
  error?: string;
  type?: string;
  body?: string;
  hasMedia?: boolean;
  mediaUrl?: string | null;
  mimeType?: string | null;
  mediaFilename?: string | null;
  isViewOnce?: boolean;
  mediaSaved?: boolean;
  mediaError?: string;
}

async function loadBlobFromMediaUrl(mediaUrl: string): Promise<string | undefined> {
  const mediaRes = await fetch(`${mediaUrl}${mediaUrl.includes("?") ? "&" : "?"}v=1`, {
    cache: "no-store",
  });
  if (!mediaRes.ok) return undefined;
  const blob = await mediaRes.blob();
  if (!blob.size) return undefined;
  return URL.createObjectURL(blob);
}

export async function decryptMessagePreview(
  chatId: string,
  messageId: string
): Promise<MessagePreviewData> {
  const res = await fetch("/api/whatsapp/messages/decrypt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId, messageId }),
  });

  const data = (await res.json()) as DecryptApiResponse;
  if (!data.ok) {
    throw new Error(data.error || "Decrypt nahi hua");
  }

  let mediaUrl = data.mediaUrl ?? null;

  if (!mediaUrl && data.hasMedia) {
    const fetchRes = await fetch(
      `/api/whatsapp/media/fetch?chatId=${encodeURIComponent(chatId)}&messageId=${encodeURIComponent(messageId)}&force=1`
    );
    const fetchData = (await fetchRes.json()) as { mediaUrl?: string };
    mediaUrl = fetchData.mediaUrl ?? null;
  }

  let blobUrl: string | undefined;
  if (mediaUrl) {
    blobUrl = await loadBlobFromMediaUrl(mediaUrl);
  }

  return {
    type: data.type || "chat",
    body: data.body || data.mediaError,
    blobUrl,
    mediaFilename: data.mediaFilename,
    isViewOnce: data.isViewOnce,
  };
}

export async function loadSavedMediaPreview(
  mediaUrl: string,
  messageType: string,
  caption?: string
): Promise<MessagePreviewData> {
  const blobUrl = await loadBlobFromMediaUrl(mediaUrl);
  return {
    type: messageType,
    body: caption,
    blobUrl,
  };
}
