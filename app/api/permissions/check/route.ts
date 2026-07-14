import { NextResponse } from "next/server";
import {
  resolveIdentity,
  userHasPermission,
} from "@/lib/server-auth";
import { isPermission } from "@/lib/permissions";

export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const permission = url.searchParams.get("permission") ?? "";
  const basketId = url.searchParams.get("basketId");
  if (!isPermission(permission)) {
    return NextResponse.json({ error: "invalid_permission" }, { status: 400 });
  }

  const allowed = await userHasPermission(
    identity.tenantId,
    identity.userId,
    permission,
    basketId
  );
  return NextResponse.json({ allowed });
}
