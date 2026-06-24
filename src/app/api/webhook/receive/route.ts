import { NextRequest, NextResponse } from "next/server";
import { addEvent } from "@/lib/store";
import { extractPayload } from "@/lib/webhook-utils";
import { getWhatsAppManager } from "@/lib/whatsapp/client";

async function handleWebhook(request: NextRequest) {
  let payload: Record<string, string> = {};
  let rawQuery: string | undefined;

  if (request.method === "GET") {
    const params: Record<string, string> = {};
    request.nextUrl.searchParams.forEach((value, key) => {
      params[key] = value;
    });
    rawQuery = request.nextUrl.search;
    payload = extractPayload(params);
  } else {
    try {
      const body = await request.json();
      const flat: Record<string, string> = {};
      for (const [key, value] of Object.entries(body)) {
        if (typeof value === "string") flat[key] = value;
        else if (value != null) flat[key] = String(value);
      }
      payload = extractPayload(flat);
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
  }

  const wa = getWhatsAppManager().getState();
  const accountId =
    wa.status === "ready" && wa.phoneNumber ? wa.phoneNumber : undefined;

  const event = await addEvent(
    {
      method: request.method,
      payload,
      rawQuery,
    },
    accountId
  );

  return NextResponse.json({
    success: true,
    eventId: event.id,
    receivedAt: event.receivedAt,
    payload,
  });
}

export async function GET(request: NextRequest) {
  return handleWebhook(request);
}

export async function POST(request: NextRequest) {
  return handleWebhook(request);
}

export async function PUT(request: NextRequest) {
  return handleWebhook(request);
}
