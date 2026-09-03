import { NextResponse } from "next/server";
import { getDb, resolveIdentity } from "@/lib/server-auth";
import { withIdentity } from "@/lib/server/pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Etkinlik sepetinin canlı durumu — useRealtimeVotes'un ihtiyacı.
 *
 * Kullanıcının KENDİ oyları `list_my_votes` RPC'siyle geliyor: votes tablosunu
 * doğrudan okumak `vote.view_all` izni ister (kimin ne oyladığı gizli), ama
 * kişinin kendi oyunu görmesi gerekiyor. Bu ayrım S3'te kuruldu, korunuyor.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const sb = getDb(req);
  const [basket, ideas] = await Promise.all([
    sb.from("baskets").select("*").eq("id", id).eq("tenant_id", identity.tenantId).maybeSingle(),
    sb.from("ideas").select("*").eq("basket_id", id).order("created_at", { ascending: true }),
  ]);

  if (!basket.data) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const myVotes = await withIdentity(identity.email, async (c) => {
    const r = await c.query<{ phase: string; idea_id: string }>(
      "select phase, idea_id from public.list_my_votes($1)",
      [id]
    );
    return r.rows;
  });

  return NextResponse.json({ basket: basket.data, ideas: ideas.data ?? [], myVotes });
}
