import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";

/** Return a non-winning basket idea back into the Kavanoz. */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const allowed = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "pool.create"
  );
  if (!allowed) {
    return NextResponse.json({ error: "forbidden", permission: "pool.create" }, { status: 403 });
  }

  let body: { idea_id?: string; basket_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  if (!body.idea_id || !body.basket_id) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const sb = supabaseAdmin();
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id, winner_idea_id, selected_idea_id, status")
    .eq("id", body.basket_id)
    .maybeSingle();

  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "basket_not_found" }, { status: 404 });
  }

  const { data: idea } = await sb
    .from("ideas")
    .select("*")
    .eq("id", body.idea_id)
    .eq("basket_id", body.basket_id)
    .maybeSingle();

  if (!idea) {
    return NextResponse.json({ error: "idea_not_found" }, { status: 404 });
  }

  const winnerId = basket.winner_idea_id ?? basket.selected_idea_id;
  if (winnerId && idea.id === winnerId) {
    return NextResponse.json({ error: "cannot_return_winner" }, { status: 400 });
  }

  const { data: poolIdea, error } = await sb
    .from("idea_pool")
    .insert({
      tenant_id: identity.tenantId,
      text: idea.text,
      brief: idea.tag ? `Kaynak etiket: ${idea.tag}` : "Sepetten geri döndü",
      category: idea.tag,
      status: "new",
      created_by: identity.email,
      source_basket_id: body.basket_id,
    })
    .select()
    .single();

  if (error || !poolIdea) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }

  return NextResponse.json({ idea: poolIdea }, { status: 200 });
}
