import { NextResponse } from "next/server";
import { getDb, resolveIdentity } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Ana ekran: tenant'ın sepetleri + her sepetin fikirleri (canlı bar için). */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sb = getDb(req);
  const { data: baskets } = await sb
    .from("baskets")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .order("created_at", { ascending: false });

  const list = (baskets ?? []) as { id: string }[];
  const ideasByBasket: Record<string, unknown[]> = {};

  if (list.length) {
    const { data: ideas } = await sb
      .from("ideas")
      .select("*")
      .eq("tenant_id", identity.tenantId)
      .in("basket_id", list.map((b) => b.id))
      .order("vote_count", { ascending: false });
    for (const idea of (ideas ?? []) as { basket_id: string }[]) {
      (ideasByBasket[idea.basket_id] ??= []).push(idea);
    }
  }

  return NextResponse.json({ baskets: list, ideasByBasket });
}
