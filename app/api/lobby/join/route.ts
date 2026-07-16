import { NextResponse } from "next/server";
import { decideLobbyJoin } from "@/lib/lobby";
import {
  resolveIdentity,
  getDb,
  userHasPermission,
} from "@/lib/server-auth";

/** POST /api/lobby/join — gated join with approval support. */
export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    basket_id?: string;
    display_name?: string | null;
  };
  if (!body.basket_id) {
    return NextResponse.json({ error: "basket_id required" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id, phase, status, lobby_locked, config, created_by")
    .eq("id", body.basket_id)
    .maybeSingle();

  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isOwner =
    basket.created_by === identity.email || basket.created_by === identity.userId;
  const decision = decideLobbyJoin({
    basket: {
      phase: basket.phase as import("@/lib/types").Phase,
      lobby_locked: Boolean(basket.lobby_locked),
      status: basket.status as import("@/lib/types").BasketStatus,
      config: (basket.config ?? {}) as import("@/lib/types").HackathonConfig,
    },
    isOwner,
  });

  if (!decision.ok) {
    return NextResponse.json(
      { error: "lobby_locked", reason: decision.reason },
      { status: 403 }
    );
  }

  const { data, error } = await sb
    .from("hackathon_participants")
    .upsert(
      {
        basket_id: body.basket_id,
        tenant_id: identity.tenantId,
        user_id: identity.userId,
        email: identity.email,
        display_name: body.display_name ?? identity.email,
        role: isOwner ? "admin" : "member",
        approved: decision.approved,
      },
      { onConflict: "basket_id,user_id" }
    )
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ participant: data, approved: decision.approved });
}

/**
 * PATCH /api/lobby/join — approve participant or set lobby_locked / policy.
 * body: { basket_id, action: 'approve'|'lock'|'policy', user_id?, lobbyPolicy?, allowLateJoin? }
 */
export async function PATCH(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await req.json()) as {
    basket_id?: string;
    action?: "approve" | "lock" | "policy";
    user_id?: string;
    lobby_locked?: boolean;
    lobbyPolicy?: "open" | "approval";
    allowLateJoin?: boolean;
  };
  if (!body.basket_id || !body.action) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: basket } = await sb
    .from("baskets")
    .select("id, tenant_id, created_by, config")
    .eq("id", body.basket_id)
    .maybeSingle();
  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const isOwner =
    basket.created_by === identity.email || basket.created_by === identity.userId;
  const canManage =
    isOwner ||
    (await userHasPermission(
      identity.tenantId,
      identity.userId,
      "hackathon.manage",
    req));
  if (!canManage) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  if (body.action === "approve") {
    if (!body.user_id) {
      return NextResponse.json({ error: "user_id required" }, { status: 400 });
    }
    await sb
      .from("hackathon_participants")
      .update({ approved: true })
      .eq("basket_id", body.basket_id)
      .eq("user_id", body.user_id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "lock") {
    await sb
      .from("baskets")
      .update({ lobby_locked: body.lobby_locked ?? true })
      .eq("id", body.basket_id);
    return NextResponse.json({ ok: true });
  }

  if (body.action === "policy") {
    const next = {
      ...(basket.config as Record<string, unknown>),
      ...(body.lobbyPolicy !== undefined
        ? { lobbyPolicy: body.lobbyPolicy }
        : {}),
      ...(body.allowLateJoin !== undefined
        ? { allowLateJoin: body.allowLateJoin }
        : {}),
    };
    await sb.from("baskets").update({ config: next }).eq("id", body.basket_id);
    return NextResponse.json({ ok: true, config: next });
  }

  return NextResponse.json({ error: "unknown_action" }, { status: 400 });
}
