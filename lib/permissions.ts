/** Fixed permission catalog (project plan E0). */

export const PERMISSIONS = [
  "hackathon.create",
  "etkinlik.create",
  "pool.create",
  "pool.promote",
  "content.moderate",
  "vote.view_all",
  "archive.view_all",
  "analytics.view",
  "tenant.manage_roles",
  "tenant.manage_settings",
  "hackathon.jury",
  "hackathon.manage",
  "platform.manage_tenants",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function isPermission(key: string): key is Permission {
  return (PERMISSIONS as readonly string[]).includes(key);
}
