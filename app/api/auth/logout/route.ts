import { NextResponse } from "next/server";
import {
  clearSessionCookie,
  isSecureRequest,
  revokeSession,
  tokenFromRequest,
} from "@/lib/server/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** POST /api/auth/logout — oturumu SUNUCUDA iptal eder, sonra çerezi siler. */
export async function POST(req: Request) {
  await revokeSession(tokenFromRequest(req));
  const res = NextResponse.json({ ok: true });
  res.headers.set("Set-Cookie", clearSessionCookie(isSecureRequest(req)));
  return res;
}
