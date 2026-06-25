import { NextRequest, NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { accountSessionExists, normalizeAccountId } from "@/lib/whatsapp/account-registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  let accountId: string | null = null;
  try {
    const body = (await request.json()) as { accountId?: string };
    accountId = body.accountId ?? null;
  } catch {
    accountId = request.nextUrl.searchParams.get("accountId");
  }

  if (!accountId) {
    return NextResponse.json({ error: "accountId is required" }, { status: 400 });
  }

  const normalized = normalizeAccountId(accountId);
  if (!(await accountSessionExists(normalized))) {
    return NextResponse.json(
      {
        error: "Is account ki saved session nahi hai. /login se dubara link karein.",
        code: "NO_SESSION",
      },
      { status: 404 }
    );
  }

  try {
    const state = await getWhatsAppManager().switchAccount(normalized);
    return NextResponse.json(state);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Switch failed" },
      { status: 500 }
    );
  }
}
