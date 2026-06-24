import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const chatId = request.nextUrl.searchParams.get("chatId");
  const messageId = request.nextUrl.searchParams.get("messageId");

  if (!chatId || !messageId) {
    return NextResponse.json(
      { error: "chatId and messageId are required" },
      { status: 400 }
    );
  }

  try {
    const manager = getWhatsAppManager();
    if (typeof manager.fetchMessageMedia !== "function") {
      return NextResponse.json({ error: "Service restarting — retry" }, { status: 503 });
    }

    const force = request.nextUrl.searchParams.get("force") === "1";

    const result = await manager.fetchMessageMedia(chatId, messageId, { force });
    if (!result.mediaUrl) {
      const status =
        result.reason === "ciphertext"
          ? 422
          : result.reason === "not_connected"
            ? 403
            : 404;
      return NextResponse.json(
        { error: result.error || "Media unavailable", reason: result.reason },
        { status }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch media" },
      { status: 500 }
    );
  }
}
