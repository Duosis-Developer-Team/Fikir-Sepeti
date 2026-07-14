import { NextResponse } from "next/server";
import { resolveIdentity, supabaseAdmin } from "@/lib/server-auth";

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { pool_idea_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const poolIdeaId = body.pool_idea_id;
  if (!poolIdeaId) {
    return NextResponse.json({ error: "pool_idea_id_required" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: idea } = await sb
    .from("idea_pool")
    .select("id, tenant_id, status, poll_closes_at")
    .eq("id", poolIdeaId)
    .maybeSingle();

  if (!idea || idea.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  if (idea.poll_closes_at && new Date(idea.poll_closes_at as string) < new Date()) {
    return NextResponse.json({ error: "poll_closed" }, { status: 400 });
  }

  const { error } = await sb.from("pool_votes").insert({
    pool_idea_id: poolIdeaId,
    tenant_id: identity.tenantId,
    voter: identity.email,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (idea.status === "new") {
    await sb.from("idea_pool").update({ status: "voting" }).eq("id", poolIdeaId);
  }

  return NextResponse.json({ ok: true });
}
