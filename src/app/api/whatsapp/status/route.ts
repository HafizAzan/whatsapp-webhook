import { NextResponse } from "next/server";
import { getWhatsAppManager } from "@/lib/whatsapp/client";
import { getWhatsAppDeploymentWarning } from "@/lib/whatsapp/deployment";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const state = getWhatsAppManager().getState();
  const deploymentWarning = getWhatsAppDeploymentWarning();
  return NextResponse.json({ ...state, deploymentWarning });
}
