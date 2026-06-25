import { NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET() {
  const snapshot = await getWhatsAppManager().getAccountsSnapshot();
  return NextResponse.json(snapshot);
}
