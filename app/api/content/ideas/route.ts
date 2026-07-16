import { NextResponse } from "next/server";
import {
  createFlags,
  evaluateText,
  writeAudit,
} from "@/lib/server-moderation";
import { warnMessage } from "@/lib/moderation";
import { resolveIdentity, supabaseAdmin } from "@/lib/server-auth";

/**
 * POST /api/content/ideas
 * Moderated idea create. block → 422; warn without acknowledge → 409 + message.
 */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    basket_id?: string;
    text?: string;
    tag?: string | null;
    acknowledge?: boolean;
  };
  const text = body.text?.trim() ?? "";
  const basketId = body.basket_id;
  if (!basketId || text.length < 2) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id")
    .eq("id", basketId)
    .maybeSingle();
  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const check = await evaluateText(sb, identity.tenantId, text);
  if (check.action === "block") {
    return NextResponse.json(
      { error: "blocked", hits: check.hits },
      { status: 422 }
    );
  }
  if (check.action === "warn" && !body.acknowledge) {
    return NextResponse.json(
      {
        error: "warn",
        message: warnMessage(check.hits),
        hits: check.hits,
      },
      { status: 409 }
    );
  }

  const { data, error } = await sb
    .from("ideas")
    .insert({
      basket_id: basketId,
      text,
      tag: body.tag ?? null,
      created_by: identity.email,
      tenant_id: identity.tenantId,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  if (check.hits.length) {
    await createFlags(sb, {
      tenant_id: identity.tenantId,
      entity_type: "idea",
      entity_id: data.id as string,
      created_by: identity.email,
      hits: check.hits.map((h) => ({ ruleId: h.ruleId, matched: h.matched })),
    });
    await writeAudit(sb, {
      tenant_id: identity.tenantId,
      actor: identity.email,
      action: "content.warn_submit",
      entity_type: "idea",
      entity_id: data.id as string,
      meta: { hits: check.hits.map((h) => h.pattern) },
    });
  }

  return NextResponse.json({ idea: data });
}
