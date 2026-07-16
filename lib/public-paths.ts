/** Routes reachable without an authenticated session (SG1). */
export const PUBLIC_PATHS = ["/", "/login", "/register"] as const;

export type PublicPath = (typeof PUBLIC_PATHS)[number];

export function isPublicPath(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  return (PUBLIC_PATHS as readonly string[]).includes(pathname);
}
