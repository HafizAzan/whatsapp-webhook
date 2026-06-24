import { NextResponse } from "next/server";
import { getEvents } from "@/lib/store";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export async function GET() {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const events = await getEvents(gate.accountId, 100);
  return NextResponse.json({ events });
}
