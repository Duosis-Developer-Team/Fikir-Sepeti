import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";

/** After a promoted basket finishes, annotate the pool row with the winner. */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "pool.promote"
  );
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", permission: "pool.promote" }, { status: 403 });
  }

  let body: { pool_idea_id?: string; winner_label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.pool_idea_id || !body.winner_label?.trim()) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data, error } = await sb
    .from("idea_pool")
    .update({ winner_label: body.winner_label.trim() })
    .eq("id", body.pool_idea_id)
    .eq("tenant_id", identity.tenantId)
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "update_failed" }, { status: 500 });
  }
  return NextResponse.json({ idea: data });
}
