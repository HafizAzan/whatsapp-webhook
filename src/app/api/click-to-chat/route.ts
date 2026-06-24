import { NextRequest, NextResponse } from "next/server";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export async function GET(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const phone = request.nextUrl.searchParams.get("phone") || "";
  const message = request.nextUrl.searchParams.get("message") || "";
  const cleanPhone = phone.replace(/\D/g, "");

  if (!cleanPhone) {
    return NextResponse.json({ error: "Phone number required" }, { status: 400 });
  }

  const url = `https://wa.me/${cleanPhone}${message ? `?text=${encodeURIComponent(message)}` : ""}`;

  return NextResponse.json({ url, phone: cleanPhone, message });
}
