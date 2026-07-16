import { NextResponse } from "next/server";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
} from "@/lib/server-auth";

/**
 * PATCH /api/analytics/production
 * Update production_note / effort_estimate on a resolved basket.
 * Requires hackathon.manage or analytics.view (tenant admin path).
 */
export async function PATCH(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    basketId?: string;
    production_note?: string | null;
    effort_estimate?: number | null;
  };
  if (!body.basketId) {
    return NextResponse.json({ error: "basketId required" }, { status: 400 });
  }

  const canManage = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "hackathon.manage",
    req);
  const canAnalytics = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "analytics.view",
    req);
  if (!canManage && !canAnalytics) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const sb = getDb(req);
  const { data: basket, error: fetchErr } = await sb
    .from("baskets")
    .select("id, tenant_id, status")
    .eq("id", body.basketId)
    .maybeSingle();

  if (fetchErr || !basket) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const patch: Record<string, unknown> = {};
  if (body.production_note !== undefined) {
    patch.production_note = body.production_note;
  }
  if (body.effort_estimate !== undefined) {
    patch.effort_estimate = body.effort_estimate;
  }
  if (!Object.keys(patch).length) {
    return NextResponse.json({ error: "nothing to update" }, { status: 400 });
  }

  const { data, error } = await sb
    .from("baskets")
    .update(patch)
    .eq("id", body.basketId)
    .eq("tenant_id", identity.tenantId)
    .select(
      "id, title, production_note, effort_estimate, status, phase"
    )
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ basket: data });
}
