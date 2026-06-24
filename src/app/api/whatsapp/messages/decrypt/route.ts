import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  let chatId: string | null = null;
  let messageId: string | null = null;

  try {
    const body = (await request.json()) as { chatId?: string; messageId?: string };
    chatId = body.chatId ?? null;
    messageId = body.messageId ?? null;
  } catch {
    chatId = request.nextUrl.searchParams.get("chatId");
    messageId = request.nextUrl.searchParams.get("messageId");
  }

  if (!chatId || !messageId) {
    return NextResponse.json(
      { ok: false, error: "chatId and messageId are required" },
      { status: 400 }
    );
  }

  try {
    const manager = getWhatsAppManager();
    if (typeof manager.retryCiphertextMessage !== "function") {
      return NextResponse.json(
        { ok: false, error: "Service restarting — retry" },
        { status: 503 }
      );
    }

    const result = await manager.retryCiphertextMessage(chatId, messageId);
    // Always 200 — success/failure is in `ok` + `error` (422 confused users in DevTools)
    return NextResponse.json(result);
  } catch (err) {
    console.error("POST /api/whatsapp/messages/decrypt error:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Decrypt failed",
      },
      { status: 500 }
    );
  }
}
