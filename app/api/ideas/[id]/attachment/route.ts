import { NextResponse } from "next/server";
import { getDb, resolveIdentity, userHasPermission, type RequestIdentity } from "@/lib/server-auth";
import { withIdentity } from "@/lib/server/pg";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 15 * 1024 * 1024; // 15MB — Postgres'te bytea olarak tutuluyor, ölçülü tutuluyor.

type IdeaRow = { id: string; basket_id: string; tenant_id: string; created_by: string | null };

async function loadIdea(req: Request, ideaId: string, tenantId: string): Promise<IdeaRow | null> {
  const sb = getDb(req);
  const { data } = await sb
    .from("ideas")
    .select("id, basket_id, tenant_id, created_by")
    .eq("id", ideaId)
    .maybeSingle();
  if (!data || data.tenant_id !== tenantId) return null;
  return data as IdeaRow;
}

/** Fikrin sahibi ya da sepeti yönetebilen (hackathon.manage) yükleyebilir/silebilir. */
async function canManageIdea(req: Request, idea: IdeaRow, identity: RequestIdentity): Promise<boolean> {
  if (idea.created_by === identity.email) return true;
  const sb = getDb(req);
  const { data: basket } = await sb.from("baskets").select("created_by").eq("id", idea.basket_id).maybeSingle();
  if (basket?.created_by === identity.email) return true;
  return userHasPermission(identity.tenantId, identity.userId, "hackathon.manage", idea.basket_id, req);
}

/** GET — dosyayı akıtır. ?meta=1 ise sadece {filename, mime_type, size_bytes} döner. */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const idea = await loadIdea(req, id, identity.tenantId);
  if (!idea) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const metaOnly = new URL(req.url).searchParams.get("meta") === "1";

  const result = await withIdentity(identity.email, (client) =>
    client.query(
      metaOnly
        ? `select filename, mime_type, size_bytes from idea_attachments where idea_id = $1 order by created_at desc limit 1`
        : `select filename, mime_type, size_bytes, data from idea_attachments where idea_id = $1 order by created_at desc limit 1`,
      [id]
    )
  );
  const file = result.rows[0] as
    | { filename: string; mime_type: string; size_bytes: number; data?: Buffer }
    | undefined;
  if (!file) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (metaOnly) {
    return NextResponse.json({
      filename: file.filename,
      mime_type: file.mime_type,
      size_bytes: file.size_bytes,
    });
  }

  return new NextResponse(file.data, {
    headers: {
      "Content-Type": file.mime_type || "application/octet-stream",
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.filename)}"`,
      "Content-Length": String(file.size_bytes),
      "Cache-Control": "private, max-age=0, must-revalidate",
    },
  });
}

/** POST — multipart/form-data { file }. Var olan eki değiştirir (fikir başına tek dosya). */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const idea = await loadIdea(req, id, identity.tenantId);
  if (!idea) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await canManageIdea(req, idea, identity))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!file || typeof file === "string") {
    return NextResponse.json({ error: "file_required" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "file_too_large" }, { status: 413 });
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const filename = file.name || "dosya";
  const mimeType = file.type || "application/octet-stream";

  await withIdentity(identity.email, async (client) => {
    await client.query(`delete from idea_attachments where idea_id = $1`, [id]);
    await client.query(
      `insert into idea_attachments (idea_id, tenant_id, filename, mime_type, size_bytes, data, uploaded_by)
       values ($1, $2, $3, $4, $5, $6, $7)`,
      [id, identity.tenantId, filename, mimeType, buf.length, buf, identity.email]
    );
  });

  return NextResponse.json({ ok: true, filename, mime_type: mimeType, size_bytes: buf.length });
}

/** DELETE — eki kaldırır. */
export async function DELETE(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;

  const idea = await loadIdea(req, id, identity.tenantId);
  if (!idea) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (!(await canManageIdea(req, idea, identity))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  await withIdentity(identity.email, (client) => client.query(`delete from idea_attachments where idea_id = $1`, [id]));
  return NextResponse.json({ ok: true });
}
