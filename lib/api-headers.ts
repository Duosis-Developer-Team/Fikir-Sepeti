"use client";

import { supabase } from "./supabase";

/**
 * Headers for browser → Next API routes.
 * Always attach Authorization Bearer when a session exists.
 * CI/dev bypass: also set X-Dev-User when NEXT_PUBLIC_AUTH_BYPASS=1.
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
  }

  let {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.access_token) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session;
  }

  const token = session?.access_token;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }
  return headers;
}
