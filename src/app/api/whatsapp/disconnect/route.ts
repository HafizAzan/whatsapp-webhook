import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  let removeSession = false;
  try {
    const body = (await request.json()) as { removeSession?: boolean };
    removeSession = Boolean(body.removeSession);
  } catch {
    // default: keep saved session for account switching
  }

  try {
    const state = await getWhatsAppManager().disconnect({ removeSession });
    return NextResponse.json(state);
  } catch (err) {
    console.error("POST /api/whatsapp/disconnect error:", err);
    return NextResponse.json(
      {
        status: "disconnected",
        connectMethod: null,
        qrCodeDataUrl: null,
        pairingCode: null,
        pairingPhone: null,
        phoneNumber: null,
        pushName: null,
        error: err instanceof Error ? err.message : "Disconnect failed",
      },
      { status: 200 }
    );
  }
}
