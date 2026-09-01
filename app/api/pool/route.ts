import { NextResponse } from "next/server";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
} from "@/lib/server-auth";
import { withIdentity } from "@/lib/server/pg";

export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getDb(req);
  const { data, error } = await sb
    .from("idea_pool")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const ideas = (data ?? []) as { id: string; promoted_basket_id: string | null }[];

  // Kullanıcının kendi oyları: pool_votes'u doğrudan okumak `vote.view_all`
  // ister (kimin ne oyladığı gizli), ama kişi kendi oyunu görmeli. RPC tam
  // olarak bu ayrım için var (0006).
  const myVoteRows = await withIdentity(identity.email, async (c) => {
    const r = await c.query<{ pool_idea_id: string }>("select * from public.list_my_pool_votes()");
    return r.rows;
  });

  // "→ Hackathon'da kullanıldı" rozeti için dönüştürülen sepetin tipi/başlığı.
  const basketIds = [...new Set(ideas.map((i) => i.promoted_basket_id).filter((v): v is string => !!v))];
  const promotedBaskets: Record<string, { type: string; title: string }> = {};
  if (basketIds.length) {
    const { data: rows } = await sb.from("baskets").select("id, type, title").in("id", basketIds);
    for (const b of (rows ?? []) as { id: string; type: string; title: string }[]) {
      promotedBaskets[b.id] = { type: b.type, title: b.title };
    }
  }

  return NextResponse.json({
    ideas,
    myVotes: myVoteRows.map((r) => r.pool_idea_id),
    promotedBaskets,
  });
}

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "pool.create",
    req);
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", permission: "pool.create" }, { status: 403 });
  }

  let body: {
    text?: string;
    brief?: string | null;
    category?: string | null;
    track_hint?: "hackathon" | "etkinlik" | null;
    poll_closes_at?: string | null;
    status?: string;
    acknowledge?: boolean;
    parent_idea_id?: string | null;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  if (text.length < 2) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }

  const { createFlags, evaluateText, writeAudit } = await import(
    "@/lib/server-moderation"
  );
  const { warnMessage } = await import("@/lib/moderation");
  const sb = getDb(req);
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

  const status =
    body.poll_closes_at || body.status === "voting" ? "voting" : body.status === "new" ? "new" : body.poll_closes_at ? "voting" : "new";

  let parentIdeaId: string | null = null;
  if (body.parent_idea_id) {
    const { data: parent } = await sb
      .from("idea_pool")
      .select("id, tenant_id")
      .eq("id", body.parent_idea_id)
      .maybeSingle();
    if (parent && parent.tenant_id === identity.tenantId) {
      parentIdeaId = parent.id as string;
    }
  }

  const { data, error } = await sb
    .from("idea_pool")
    .insert({
      tenant_id: identity.tenantId,
      text,
      brief: body.brief?.trim() || null,
      category: body.category?.trim() || null,
      track_hint: body.track_hint ?? null,
      status,
      created_by: identity.email,
      poll_closes_at: body.poll_closes_at ?? null,
      parent_idea_id: parentIdeaId,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  if (check.hits.length) {
    await createFlags(sb, {
      tenant_id: identity.tenantId,
      entity_type: "pool",
      entity_id: data.id as string,
      created_by: identity.email,
      hits: check.hits.map((h) => ({ ruleId: h.ruleId, matched: h.matched })),
    });
    await writeAudit(sb, {
      tenant_id: identity.tenantId,
      actor: identity.email,
      action: "content.warn_submit",
      entity_type: "pool",
      entity_id: data.id as string,
    });
  }

  return NextResponse.json({ idea: data }, { status: 200 });
}
