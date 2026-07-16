import { NextResponse } from "next/server";
import { resolveIdentity } from "@/lib/server-auth";

/** GET /api/me — auth health for QA (identity or 401). */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.json({
    ok: true,
    email: identity.email,
    userId: identity.userId,
    tenantId: identity.tenantId,
  });
}
