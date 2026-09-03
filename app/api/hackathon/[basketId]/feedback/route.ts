import { NextResponse } from "next/server";
import { getDb, resolveIdentity } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sepetin feedback listesi. Yazma /api/content/feedback'te (moderasyondan geçer). */
export async function GET(req: Request, ctx: { params: Promise<{ basketId: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { basketId } = await ctx.params;

  const sb = getDb(req);
  const { data, error } = await sb
    .from("feedback")
    .select("*")
    .eq("basket_id", basketId)
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ feedback: data ?? [] });
}
