import { NextResponse } from "next/server";
import { resolveIdentity, getDb } from "@/lib/server-auth";

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { suggestion_id?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const suggestionId = body.suggestion_id;
  if (!suggestionId) {
    return NextResponse.json({ error: "suggestion_id_required" }, { status: 400 });
  }

  const sb = getDb(req);
  const { data: suggestion } = await sb
    .from("suggestions")
    .select("id, tenant_id")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!suggestion || suggestion.tenant_id !== identity.tenantId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const { error } = await sb.from("suggestion_votes").insert({
    suggestion_id: suggestionId,
    tenant_id: identity.tenantId,
    voter: identity.email,
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
