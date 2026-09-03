import { NextResponse } from "next/server";
import { getDb, resolveIdentity, userHasPermission } from "@/lib/server-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sepetin sahibi mi / yönetebiliyor mu? */
async function canManage(req: Request, basketId: string, identity: { tenantId: string; userId: string; email: string }) {
  const sb = getDb(req);
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id, created_by")
    .eq("id", basketId)
    .maybeSingle();
  if (!basket || basket.tenant_id !== identity.tenantId) return { ok: false as const, status: 404 };
  if (basket.created_by === identity.email) return { ok: true as const };
  const perm = await userHasPermission(identity.tenantId, identity.userId, "hackathon.manage", basketId, req);
  return perm ? { ok: true as const } : { ok: false as const, status: 403 };
}

/**
 * PATCH — fikir üzerindeki organizatör işlemleri: finalist işaretleme ve
 * demo alanları (link/sunan/saat). Eskiden hepsi istemciden doğrudan
 * yazılıyordu; RLS yalnızca tenant sınırını koruyordu, yani aynı tenant'taki
 * herhangi biri başkasının sepetindeki finalistleri değiştirebiliyordu.
 */
export async function PATCH(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = (await req.json().catch(() => ({}))) as {
    basket_id?: string;
    action?: "finalists" | "demo";
    finalist_ids?: string[];
    idea_id?: string;
    demo_url?: string | null;
    presenter?: string | null;
    live_at?: string | null;
  };
  if (!body.basket_id) return NextResponse.json({ error: "basket_id required" }, { status: 400 });

  const gate = await canManage(req, body.basket_id, identity);
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });

  const sb = getDb(req);

  if (body.action === "finalists") {
    const ids = body.finalist_ids ?? [];
    await sb.from("ideas").update({ is_finalist: false }).eq("basket_id", body.basket_id);
    if (ids.length) {
      await sb.from("ideas").update({ is_finalist: true }).in("id", ids).eq("basket_id", body.basket_id);
    }
    return NextResponse.json({ ok: true });
  }

  if (body.action === "demo") {
    if (!body.idea_id) return NextResponse.json({ error: "idea_id required" }, { status: 400 });
    const fields: Record<string, unknown> = {};
    if ("demo_url" in body) fields.demo_url = body.demo_url;
    if ("presenter" in body) fields.presenter = body.presenter;
    if ("live_at" in body) fields.live_at = body.live_at;
    if (!Object.keys(fields).length) return NextResponse.json({ error: "no_fields" }, { status: 400 });
    await sb.from("ideas").update(fields).eq("id", body.idea_id).eq("basket_id", body.basket_id);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}

/** DELETE — fikri sil. Sepet sahibi ya da fikrin sahibi. */
export async function DELETE(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const ideaId = new URL(req.url).searchParams.get("idea_id");
  if (!ideaId) return NextResponse.json({ error: "idea_id required" }, { status: 400 });

  const sb = getDb(req);
  const { data: idea } = await sb
    .from("ideas")
    .select("id, basket_id, tenant_id, created_by")
    .eq("id", ideaId)
    .maybeSingle();
  if (!idea || idea.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (idea.created_by !== identity.email) {
    const gate = await canManage(req, idea.basket_id, identity);
    if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: gate.status });
  }

  const { error } = await sb.from("ideas").delete().eq("id", ideaId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
