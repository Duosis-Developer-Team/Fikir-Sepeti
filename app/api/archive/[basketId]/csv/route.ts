import { NextResponse } from "next/server";
import {
  resolveIdentity,
  supabaseAdmin,
  userHasPermission,
} from "@/lib/server-auth";

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export async function GET(
  req: Request,
  ctx: { params: Promise<{ basketId: string }> }
) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { basketId } = await ctx.params;
  const sb = supabaseAdmin();
  const { data: basket } = await sb.from("baskets").select("*").eq("id", basketId).maybeSingle();
  if (!basket || basket.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const viewAll = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "archive.view_all"
  );
  const isOwner =
    basket.created_by === identity.email || basket.created_by === identity.userId;
  if (!viewAll && !isOwner) {
    const { data: part } = await sb
      .from("hackathon_participants")
      .select("id")
      .eq("basket_id", basketId)
      .eq("user_id", identity.userId)
      .maybeSingle();
    const { data: vote } = await sb
      .from("votes")
      .select("id")
      .eq("basket_id", basketId)
      .eq("voter", identity.email)
      .limit(1)
      .maybeSingle();
    if (!part && !vote) {
      return NextResponse.json({ error: "forbidden" }, { status: 403 });
    }
  }

  const { data: ideas } = await sb
    .from("ideas")
    .select("id, text, vote_count, created_by, tag")
    .eq("basket_id", basketId)
    .order("vote_count", { ascending: false });

  const { data: votes } = await sb
    .from("votes")
    .select("idea_id, phase, voter, created_at")
    .eq("basket_id", basketId);

  const winnerId = basket.winner_idea_id ?? basket.selected_idea_id;
  const lines = [
    ["section", "field", "value"].join(","),
    ["meta", "title", csvEscape(basket.title)].join(","),
    ["meta", "type", csvEscape(basket.type)].join(","),
    ["meta", "status", csvEscape(basket.status)].join(","),
    ["meta", "created_at", csvEscape(basket.created_at)].join(","),
    ["meta", "winner_idea_id", csvEscape(winnerId)].join(","),
  ];

  for (const idea of ideas ?? []) {
    lines.push(
      ["idea", "text", csvEscape(idea.text)].join(","),
      ["idea", "vote_count", csvEscape(idea.vote_count)].join(","),
      ["idea", "created_by", csvEscape(idea.created_by)].join(","),
      ["idea", "is_winner", idea.id === winnerId ? "yes" : "no"].join(",")
    );
  }

  for (const v of votes ?? []) {
    lines.push(
      ["vote", "phase", csvEscape(v.phase)].join(","),
      ["vote", "voter", csvEscape(v.voter)].join(","),
      ["vote", "idea_id", csvEscape(v.idea_id)].join(",")
    );
  }

  const body = lines.join("\n") + "\n";
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="archive-${basketId.slice(0, 8)}.csv"`,
    },
  });
}
