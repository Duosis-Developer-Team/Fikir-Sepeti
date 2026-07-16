import { NextResponse } from "next/server";
import { resolveIdentity, userHasPermission } from "@/lib/server-auth";
import type { Permission } from "@/lib/permissions";

/**
 * GET /api/permissions?keys=hackathon.jury,analytics.view&basketId=
 * Returns which of the requested permissions the caller holds.
 */
export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const keys = (url.searchParams.get("keys") ?? "")
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean) as Permission[];
  const basketId = url.searchParams.get("basketId");

  const result: Record<string, boolean> = {};
  for (const key of keys) {
    result[key] = await userHasPermission(
      identity.tenantId,
      identity.userId,
      key,
      basketId,
      req
    );
  }

  return NextResponse.json({ permissions: result });
}
