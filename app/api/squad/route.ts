import { NextResponse } from "next/server";
import { getDb, resolveIdentity } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const basketId = new URL(req.url).searchParams.get("basket_id");
  if (!basketId) return NextResponse.json({ error: "basket_id required" }, { status: 400 });

  const sb = getDb(req);
  const { data } = await sb
    .from("squad_members")
    .select("member")
    .eq("basket_id", basketId)
    .order("created_at", { ascending: true });
  return NextResponse.json({ members: ((data ?? []) as { member: string }[]).map((r) => r.member) });
}

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const { basket_id, member } = (await req.json().catch(() => ({}))) as {
    basket_id?: string;
    member?: string;
  };
  if (!basket_id || !member) {
    return NextResponse.json({ error: "basket_id ve member gerekli" }, { status: 400 });
  }

  const sb = getDb(req);
  const { error } = await sb
    .from("squad_members")
    .insert({ basket_id, member, tenant_id: identity.tenantId });

  // Aynı üye iki kez: unique ihlali beklenen durum, hata değil.
  if (error && error.code !== "23505") {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
