import { NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const snapshot = await getWhatsAppManager().getAccountsSnapshot();
  return NextResponse.json(snapshot);
}
