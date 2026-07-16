"use client";

import { supabase } from "./supabase";

/**
 * Headers for browser → Next API routes.
 * Prod: Authorization Bearer from Supabase session.
 * CI/dev bypass: X-Dev-User (NEXT_PUBLIC_AUTH_BYPASS=1).
 */
export async function apiAuthHeaders(
  email?: string,
  tenantId?: string | null
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "1" && email && tenantId) {
    headers["X-Dev-User"] = JSON.stringify({ email, tenantId });
    return headers;
  }

  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
