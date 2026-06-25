import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import type { WhatsAppConnectMethod } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const method: WhatsAppConnectMethod =
      body.method === "pairing" ? "pairing" : "qr";
    const phoneNumber =
      typeof body.phoneNumber === "string" ? body.phoneNumber : undefined;
    const accountId = typeof body.accountId === "string" ? body.accountId : undefined;
    const restore = Boolean(body.restore);
    const newLink = body.newLink !== false;

    const state = await getWhatsAppManager().connect({
      method,
      phoneNumber,
      accountId,
      restore,
      newLink,
    });
    return NextResponse.json(state);
  } catch {
    return NextResponse.json(
      { status: "error", error: "Invalid connect request" },
      { status: 400 }
    );
  }
}
