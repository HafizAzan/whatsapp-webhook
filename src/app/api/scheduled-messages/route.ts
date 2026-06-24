import { NextRequest, NextResponse } from "next/server";
import {
  getScheduledMessages,
  createScheduledMessage,
  deleteScheduledMessage,
} from "@/lib/store";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export async function GET() {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const messages = await getScheduledMessages(gate.accountId);
  return NextResponse.json({ messages });
}

export async function POST(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const message = await createScheduledMessage(gate.accountId, {
      phone: body.phone,
      message: body.message,
      scheduledAt: body.scheduledAt,
    });
    return NextResponse.json({ message }, { status: 201 });
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
  const deleted = await deleteScheduledMessage(id, gate.accountId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
