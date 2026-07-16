import { NextResponse } from "next/server";
import {
  createFlags,
  evaluateText,
  writeAudit,
} from "@/lib/server-moderation";
import { warnMessage } from "@/lib/moderation";
import { resolveIdentity, getDb } from "@/lib/server-auth";

/** POST /api/content/feedback — moderated feedback create. */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    basket_id?: string;
    text?: string;
    team_id?: string | null;
    idea_id?: string | null;
    author_name?: string | null;
    acknowledge?: boolean;
  };
  const text = body.text?.trim() ?? "";
  if (!body.basket_id || text.length < 2) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id")
    .eq("id", body.basket_id)
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
    .from("feedback")
    .insert({
      basket_id: body.basket_id,
      tenant_id: identity.tenantId,
      team_id: body.team_id ?? null,
      idea_id: body.idea_id ?? null,
      author_id: identity.email,
      author_name: body.author_name ?? identity.email,
      text,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  if (check.hits.length) {
    await createFlags(sb, {
      tenant_id: identity.tenantId,
      entity_type: "feedback",
      entity_id: data.id as string,
      created_by: identity.email,
      hits: check.hits.map((h) => ({ ruleId: h.ruleId, matched: h.matched })),
    });
    await writeAudit(sb, {
      tenant_id: identity.tenantId,
      actor: identity.email,
      action: "content.warn_submit",
      entity_type: "feedback",
      entity_id: data.id as string,
    });
  }

  return NextResponse.json({ feedback: data });
}
