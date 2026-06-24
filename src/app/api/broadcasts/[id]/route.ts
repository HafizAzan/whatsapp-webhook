import { NextRequest, NextResponse } from "next/server";
import { deleteBroadcast, getBroadcastById, updateBroadcast } from "@/lib/store";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const broadcast = await getBroadcastById(id, gate.accountId);
  if (!broadcast) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ broadcast });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  try {
    const { id } = await params;
    const body = await request.json();
    const broadcast = await updateBroadcast(id, gate.accountId, {
      name: body.name,
      message: body.message,
      contacts: body.contacts,
      status: body.status,
    });
    if (!broadcast) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ broadcast });
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const { id } = await params;
  const deleted = await deleteBroadcast(id, gate.accountId);
  if (!deleted) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
