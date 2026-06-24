import { NextRequest, NextResponse } from "next/server";
import { getSmartReplies, createSmartReply, deleteSmartReply } from "@/lib/store";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export async function GET() {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const replies = await getSmartReplies(gate.accountId);
  return NextResponse.json({ replies });
}

export async function POST(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const reply = await createSmartReply(gate.accountId, {
      keyword: body.keyword,
      reply: body.reply,
      enabled: body.enabled ?? true,
    });
    return NextResponse.json({ reply }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const deleted = await deleteSmartReply(id, gate.accountId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
