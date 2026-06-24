import { NextRequest, NextResponse } from "next/server";
import { getWebhook, updateWebhook, deleteWebhook } from "@/lib/store";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, context: RouteContext) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const webhook = await getWebhook(id, gate.accountId);
  if (!webhook) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  return NextResponse.json({ webhook });
}

export async function PUT(request: NextRequest, context: RouteContext) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  try {
    const body = await request.json();
    const webhook = await updateWebhook(id, gate.accountId, body);
    if (!webhook) {
      return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
    }
    return NextResponse.json({ webhook });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const { id } = await context.params;
  const deleted = await deleteWebhook(id, gate.accountId);
  if (!deleted) {
    return NextResponse.json({ error: "Webhook not found" }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
