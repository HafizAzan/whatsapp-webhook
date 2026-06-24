import { NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";

export type WhatsAppAccountGate =
  | { ok: true; accountId: string }
  | { ok: false; response: NextResponse };

/** APIs that require an active WhatsApp channel link */
export function requireWhatsAppAccount(): WhatsAppAccountGate {
  const state = getWhatsAppManager().getState();

  if (state.status !== "ready" || !state.phoneNumber) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: "WhatsApp channel not linked. Please login first.",
          code: "CHANNEL_NOT_LINKED",
        },
        { status: 403 }
      ),
    };
  }

  return { ok: true, accountId: state.phoneNumber };
}

export function emptyListResponse<T extends string>(key: T) {
  return NextResponse.json(
    { [key]: [], error: "WhatsApp channel not linked", code: "CHANNEL_NOT_LINKED" },
    { status: 403 }
  );
}
