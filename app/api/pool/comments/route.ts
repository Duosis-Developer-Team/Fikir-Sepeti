import { NextResponse } from "next/server";
import { createFlags, evaluateText, writeAudit } from "@/lib/server-moderation";
import { warnMessage } from "@/lib/moderation";
import { resolveIdentity, getDb } from "@/lib/server-auth";

/** GET /api/pool/comments?pool_idea_id=... — bir sepet fikrinin yorumları. */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const poolIdeaId = new URL(req.url).searchParams.get("pool_idea_id");
  if (!poolIdeaId) {
    return NextResponse.json({ error: "pool_idea_id_required" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data, error } = await sb
    .from("idea_pool_comments")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .eq("pool_idea_id", poolIdeaId)
    .order("created_at", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ comments: data ?? [] });
}

/** POST /api/pool/comments — moderated yorum ekleme. */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    pool_idea_id?: string;
    text?: string;
    author_name?: string | null;
    acknowledge?: boolean;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  if (!body.pool_idea_id || text.length < 2) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: idea } = await sb
    .from("idea_pool")
    .select("id, tenant_id")
    .eq("id", body.pool_idea_id)
    .maybeSingle();
  if (!idea || idea.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const check = await evaluateText(sb, identity.tenantId, text);
  if (check.action === "block") {
    return NextResponse.json({ error: "blocked", hits: check.hits }, { status: 422 });
  }
  if (check.action === "warn" && !body.acknowledge) {
    return NextResponse.json(
      { error: "warn", message: warnMessage(check.hits), hits: check.hits },
      { status: 409 }
    );
  }

  const { data, error } = await sb
    .from("idea_pool_comments")
    .insert({
      tenant_id: identity.tenantId,
      pool_idea_id: body.pool_idea_id,
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
      entity_type: "pool_comment",
      entity_id: data.id as string,
      created_by: identity.email,
      hits: check.hits.map((h) => ({ ruleId: h.ruleId, matched: h.matched })),
    });
    await writeAudit(sb, {
      tenant_id: identity.tenantId,
      actor: identity.email,
      action: "content.warn_submit",
      entity_type: "pool_comment",
      entity_id: data.id as string,
    });
  }

  return NextResponse.json({ comment: data });
}
