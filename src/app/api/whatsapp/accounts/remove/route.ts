import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import {
  normalizeAccountId,
  removeLinkedAccount,
} from "@/lib/whatsapp/account-registry";

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

  const normalized = normalizeAccountId(accountId);

  try {
    const snapshot = await getWhatsAppManager().removeAccount(normalized);
    return NextResponse.json(snapshot);
  } catch (err) {
    console.error("POST /api/whatsapp/accounts/remove error:", err);

    // Best-effort registry cleanup even if manager disconnect failed
    try {
      await removeLinkedAccount(normalized);
    } catch (cleanupErr) {
      console.error("remove account fallback cleanup:", cleanupErr);
    }

    try {
      const snapshot = await getWhatsAppManager().getAccountsSnapshot();
      return NextResponse.json({
        ...snapshot,
        warning: err instanceof Error ? err.message : "Remove partially completed",
      });
    } catch {
      return NextResponse.json(
        {
          accounts: [],
          activeAccountId: null,
          connectedAccountId: null,
          error: err instanceof Error ? err.message : "Remove failed",
        },
        { status: 200 }
      );
    }
  }
}
