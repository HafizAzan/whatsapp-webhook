/** Opaque URL hash tokens — raw WhatsApp IDs URL mein visible nahi */

function toBase64Url(value: string): string {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(token: string): string | null {
  try {
    const base64 = token.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function encodeRouteRef(value: string): string {
  return toBase64Url(value);
}

export function decodeRouteRef(token: string): string | null {
  if (!token) return null;
  return fromBase64Url(token);
}

export function chatHashHref(chatId: string) {
  return `/chats#${encodeRouteRef(chatId)}`;
}

export function broadcastHashHref(broadcastId: string) {
  return `/broadcasts#${encodeRouteRef(broadcastId)}`;
}
