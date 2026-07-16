import { NextResponse } from "next/server";
import { evaluateText } from "@/lib/server-moderation";
import { warnMessage } from "@/lib/moderation";
import { resolveIdentity, supabaseAdmin } from "@/lib/server-auth";

/** POST /api/moderation/check — preview matches without writing. */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as { text?: string };
  const text = body.text?.trim() ?? "";
  if (!text) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  const result = await evaluateText(supabaseAdmin(), identity.tenantId, text);
  return NextResponse.json({
    ...result,
    message: result.action === "warn" ? warnMessage(result.hits) : null,
  });
}
