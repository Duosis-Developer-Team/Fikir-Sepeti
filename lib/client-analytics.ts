"use client";

import { apiAuthHeaders } from "./api-headers";

export type AnalyticsTeaser = {
  lastEventsCount: number;
  participationPct: number | null;
  headline: string;
  productionCount: number;
};

export type AnalyticsFull = {
  teaser: AnalyticsTeaser;
  canViewFull: boolean;
  funnel: {
    key: string;
    label: string;
    count: number;
    rateFromPrev: number | null;
    rateFromStart: number | null;
  }[];
  retention: {
    month1Active: number;
    month3Active: number;
    rate: number;
    anchorMonth: string;
    asOfMonth: string;
  };
  production: {
    id: string;
    title: string;
    type: string;
    created_by: string | null;
    created_at: string;
    production_note: string | null;
    effort_estimate: number | null;
  }[];
  effortTotal: number;
};

export async function fetchAnalyticsTeaser(input: {
  email: string;
  tenantId: string;
}): Promise<{ teaser: AnalyticsTeaser; canViewFull: boolean } | null> {
  const res = await fetch("/api/analytics", {
    headers: await apiAuthHeaders(input.email, input.tenantId),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function fetchAnalyticsFull(input: {
  email: string;
  tenantId: string;
}): Promise<AnalyticsFull | { error: string; status: number } | null> {
  const res = await fetch("/api/analytics?full=1", {
    headers: await apiAuthHeaders(input.email, input.tenantId),
  });
  if (res.status === 403) {
    return { error: "analytics.view required", status: 403 };
  }
  if (!res.ok) return null;
  return res.json();
}

export async function updateProductionMeta(input: {
  email: string;
  tenantId: string;
  basketId: string;
  production_note?: string | null;
  effort_estimate?: number | null;
}): Promise<boolean> {
  const res = await fetch("/api/analytics/production", {
    method: "PATCH",
    headers: await apiAuthHeaders(input.email, input.tenantId),
    body: JSON.stringify({
      basketId: input.basketId,
      production_note: input.production_note,
      effort_estimate: input.effort_estimate,
    }),
  });
  return res.ok;
}
