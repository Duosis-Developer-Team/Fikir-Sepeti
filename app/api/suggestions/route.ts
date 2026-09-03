import { NextResponse } from "next/server";
import { resolveIdentity, getDb, userHasPermission } from "@/lib/server-auth";

export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const sb = getDb(req);
  const { data, error } = await sb
    .from("suggestions")
    .select("*")
    .eq("tenant_id", identity.tenantId)
    .order("vote_count", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const { data: voteRows } = await sb
    .from("suggestion_votes")
    .select("suggestion_id")
    .eq("tenant_id", identity.tenantId)
    .eq("voter", identity.email);

  const myVotes = ((voteRows as { suggestion_id: string }[] | null) ?? []).map(
    (r) => r.suggestion_id
  );

  const canManage = await userHasPermission(
    identity.tenantId,
    identity.userId,
    "tenant.manage_settings",
    req
  );

  // canDelete gerçek (maskelenmemiş) created_by üstünden hesaplanır — anonim gönderen
  // kendi önerisini yine silebilsin diye. Ardından gösterim için kimlik maskeleniyor.
  const suggestions = (data ?? []).map((s) => ({
    ...s,
    canDelete: canManage || s.created_by === identity.email,
    created_by: s.anonymous ? null : s.created_by,
  }));

  return NextResponse.json({ suggestions, myVotes, canManage });
}

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { text?: string; anonymous?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const text = body.text?.trim() ?? "";
  if (text.length < 2) {
    return NextResponse.json({ error: "text_required" }, { status: 400 });
  }
  if (text.length > 1000) {
    return NextResponse.json({ error: "text_too_long" }, { status: 400 });
  }
  const anonymous = body.anonymous === true;

  const sb = getDb(req);
  const { data, error } = await sb
    .from("suggestions")
    .insert({
      tenant_id: identity.tenantId,
      text,
      created_by: identity.email,
      anonymous,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  const suggestion = anonymous ? { ...data, created_by: null } : data;
  return NextResponse.json({ suggestion });
}
