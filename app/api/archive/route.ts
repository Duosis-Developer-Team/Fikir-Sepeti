import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";

/** List resolved baskets for archive — scoped by archive.view_all. */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const type = url.searchParams.get("type"); // etkinlik | hackathon | null
  const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();

  const sb = supabaseAdmin();
  let query = sb
    .from("baskets")
    .select("id, title, type, phase, status, winner_idea_id, selected_idea_id, created_by, created_at, hackathon_ends_at, tenant_id, config")
    .eq("tenant_id", identity.tenantId)
    .eq("status", "resolved")
    .order("created_at", { ascending: false });

  if (type === "etkinlik" || type === "hackathon") {
    query = query.eq("type", type);
  }

  const { data: baskets, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const viewAll = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "archive.view_all"
  );

  let rows = baskets ?? [];

  if (!viewAll) {
    const ids = rows.map((b) => b.id as string);
    const allowed = new Set<string>();

    // baskets I created
    for (const b of rows) {
      if (b.created_by === identity.email || b.created_by === identity.userId) {
        allowed.add(b.id as string);
      }
    }

    if (ids.length) {
      const { data: parts } = await sb
        .from("hackathon_participants")
        .select("basket_id")
        .eq("tenant_id", identity.tenantId)
        .eq("user_id", identity.userId)
        .in("basket_id", ids);
      for (const p of parts ?? []) allowed.add(p.basket_id as string);

      const { data: votes } = await sb
        .from("votes")
        .select("basket_id")
        .eq("tenant_id", identity.tenantId)
        .eq("voter", identity.email)
        .in("basket_id", ids);
      for (const v of votes ?? []) allowed.add(v.basket_id as string);
    }

    rows = rows.filter((b) => allowed.has(b.id as string));
  }

  if (q) {
    rows = rows.filter((b) => (b.title as string).toLowerCase().includes(q));
  }

  return NextResponse.json({ baskets: rows, viewAll });
}
