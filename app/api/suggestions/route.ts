import { NextResponse } from "next/server";
import { resolveIdentity, getDb } from "@/lib/server-auth";

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
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ suggestions: data ?? [] });
}

export async function POST(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { text?: string };
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

  const sb = getDb(req);
  const { data, error } = await sb
    .from("suggestions")
    .insert({
      tenant_id: identity.tenantId,
      text,
      created_by: identity.email,
    })
    .select()
    .single();

  if (error || !data) {
    return NextResponse.json({ error: error?.message ?? "insert_failed" }, { status: 500 });
  }
  return NextResponse.json({ suggestion: data });
}
