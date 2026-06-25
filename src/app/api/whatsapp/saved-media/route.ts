import { NextRequest, NextResponse } from "next/server";
import { listSavedMediaForChat, mediaApiUrl } from "@/lib/whatsapp/media-storage";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const chatId = request.nextUrl.searchParams.get("chatId");
  if (!chatId) {
    return NextResponse.json({ error: "chatId is required" }, { status: 400 });
  }

  const items = await listSavedMediaForChat(chatId);
  return NextResponse.json({
    items: items.map((item) => ({
      ...item,
      mediaUrl: mediaApiUrl(item.id),
    })),
  });
}
