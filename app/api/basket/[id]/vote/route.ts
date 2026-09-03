import { NextResponse } from "next/server";
import { getDb, resolveIdentity } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Faz başına kişi başı tek oy. Eski oy silinip yenisi yazılıyor — tabloda
 * unique(basket_id, phase, voter) var, yani ikinci bir oy zaten reddedilirdi;
 * kullanıcı için doğru davranış "oyunu değiştir".
 *
 * `voter` İSTEKTEN DEĞİL oturumdan geliyor: eskiden istemci voter alanını
 * kendisi yazıyordu ve RLS yalnızca "kendi e-postan olmalı" diyordu — doğru
 * ama kontrolü istemciye bırakmanın hiçbir faydası yoktu.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const { idea_id, phase } = (await req.json().catch(() => ({}))) as {
    idea_id?: string;
    phase?: string;
  };
  if (!idea_id) return NextResponse.json({ error: "idea_id required" }, { status: 400 });
  const votePhase = phase ?? "ideas";

  const sb = getDb(req);
  const { data: idea } = await sb
    .from("ideas")
    .select("id, basket_id, tenant_id")
    .eq("id", idea_id)
    .maybeSingle();
  if (!idea || idea.basket_id !== id || idea.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  await sb.from("votes").delete().eq("basket_id", id).eq("phase", votePhase).eq("voter", identity.email);
  const { error } = await sb.from("votes").insert({
    idea_id,
    basket_id: id,
    phase: votePhase,
    voter: identity.email,
    tenant_id: identity.tenantId,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

/** Oyu geri çek. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const phase = new URL(req.url).searchParams.get("phase") ?? "ideas";

  const sb = getDb(req);
  await sb.from("votes").delete().eq("basket_id", id).eq("phase", phase).eq("voter", identity.email);
  return NextResponse.json({ ok: true });
}
