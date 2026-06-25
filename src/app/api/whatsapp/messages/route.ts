import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const chatId = request.nextUrl.searchParams.get("chatId");
  const limit = Math.min(Math.max(Number(request.nextUrl.searchParams.get("limit") || 30), 1), 30);
  const offset = Math.max(Number(request.nextUrl.searchParams.get("offset") || 0), 0);

  if (!chatId) {
    return NextResponse.json({ messages: [], error: "chatId is required" }, { status: 400 });
  }

  try {
    const manager = getWhatsAppManager();
    if (typeof manager.getChatMessages !== "function") {
      return NextResponse.json(
        { messages: [], error: "Service restarting — retry" },
        { status: 503 }
      );
    }
    const result = await manager.getChatMessages(chatId, limit, offset);
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/whatsapp/messages error:", err);
    return NextResponse.json(
      {
        messages: [],
        error: err instanceof Error ? err.message : "Failed to load messages",
      },
      { status: 500 }
    );
  }
}
