import { NextRequest, NextResponse } from "next/server";
import { getMediaBytes, getMediaRecord } from "@/lib/whatsapp/media-storage";
import { requireWhatsAppAccount } from "@/lib/whatsapp/require-connected";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const gate = requireWhatsAppAccount();
  if (!gate.ok) return gate.response;

  const messageId = request.nextUrl.searchParams.get("id");
  if (!messageId) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const record = await getMediaRecord(messageId);
  if (!record || record.accountId !== gate.accountId) {
    return NextResponse.json({ error: "Media not found" }, { status: 404 });
  }

  const bytes = await getMediaBytes(messageId);
  if (!bytes?.byteLength) {
    return NextResponse.json({ error: "Media file missing" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(bytes), {
    headers: {
      "Content-Type": record.mimeType,
      "Content-Disposition": `inline; filename="${record.filename.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
