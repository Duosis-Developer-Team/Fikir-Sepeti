import { NextResponse } from "next/server";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
} from "@/lib/server-auth";

/**
 * POST /api/scores — upsert rubric score; is_jury derived server-side from hackathon.jury.
 */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    basket_id?: string;
    team_id?: string;
    category_key?: string;
    stars?: number;
  };

  if (
    !body.basket_id ||
    !body.team_id ||
    !body.category_key ||
    typeof body.stars !== "number" ||
    body.stars < 1 ||
    body.stars > 5
  ) {
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

  const isJury = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "hackathon.jury",
    body.basket_id,
    req);

  const { data, error } = await sb
    .from("scores")
    .upsert(
      {
        basket_id: body.basket_id,
        tenant_id: identity.tenantId,
        team_id: body.team_id,
        voter: identity.email,
        category_key: body.category_key,
        stars: body.stars,
        is_jury: isJury,
      },
      { onConflict: "basket_id,team_id,voter,category_key" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ score: data });
}
