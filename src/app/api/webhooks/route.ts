import { NextRequest, NextResponse } from "next/server";
import { getWebhooks, createWebhook } from "@/lib/store";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export async function GET() {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const webhooks = await getWebhooks(gate.accountId);
  return NextResponse.json({ webhooks });
}

export async function POST(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  try {
    const body = await request.json();
    const webhook = await createWebhook(gate.accountId, {
      name: body.name || "Untitled Webhook",
      direction: body.direction || "outgoing",
      method: body.method || "GET",
      endpoint: body.endpoint || "",
      payloadFields: body.payloadFields || [],
      enabled: body.enabled ?? true,
    });
    return NextResponse.json({ webhook }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
