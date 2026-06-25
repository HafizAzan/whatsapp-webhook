import { NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET() {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  try {
    const manager = getWhatsAppManager();
    if (typeof manager.getChats !== "function") {
      return NextResponse.json(
        { chats: [], error: "WhatsApp service restarting — please retry" },
        { status: 503 }
      );
    }
    const result = await manager.getChats();
    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/whatsapp/chats error:", err);
    return NextResponse.json(
      {
        chats: [],
        error: err instanceof Error ? err.message : "Failed to load chats",
      },
      { status: 500 }
    );
  }
}
