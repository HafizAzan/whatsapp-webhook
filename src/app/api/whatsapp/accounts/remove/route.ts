import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { normalizeAccountId } from "@/lib/whatsapp/account-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  let accountId: string | null = null;
  try {
    const body = (await request.json()) as { accountId?: string };
    accountId = body.accountId ?? null;
  } catch {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const snapshot = await getWhatsAppManager().removeAccount(normalizeAccountId(accountId));
  return NextResponse.json(snapshot);
}
