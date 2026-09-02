"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useSession } from "@/components/AuthGate";
import { apiFetch } from "@/lib/api-headers";
import { PERMISSIONS, type Permission } from "@/lib/permissions";

type PermMap = Partial<Record<Permission, boolean>>;

const PermissionsContext = createContext<{ permissions: PermMap; loading: boolean }>({
  permissions: {},
  loading: true,
});

const ALL_KEYS = PERMISSIONS.join(",");

/**
 * Global (sepet-kapsamsız) izin kümesi — oturum açık kullanıcı için TEK
 * seferde çekilip önbelleğe alınır, her buton kendi isteğini atmaz. Sepete
 * özel roller (jüri gibi) burada YOK — bkz. useScopedPermission.
 */
export function PermissionsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useSession();
  const [permissions, setPermissions] = useState<PermMap>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.tenantId) {
      setPermissions({});
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void apiFetch<{ permissions: PermMap }>(`/api/permissions?keys=${ALL_KEYS}`).then((res) => {
      if (cancelled) return;
      setPermissions(res.data?.permissions ?? {});
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.tenantId]);

  const value = useMemo(() => ({ permissions, loading }), [permissions, loading]);
  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>;
}

/** İzin belli olana kadar (ya da yoksa) false — "yetkisizken buton görünmesin" güvenli varsayılanı. */
export function usePermission(key: Permission): boolean {
  const { permissions } = useContext(PermissionsContext);
  return permissions[key] === true;
}

export function usePermissions(keys: Permission[]): PermMap {
  const { permissions } = useContext(PermissionsContext);
  const sig = keys.join(",");
  return useMemo(() => {
    const out: PermMap = {};
    for (const k of keys) out[k] = permissions[k] === true;
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` is keys' content signature, keys itself is a fresh literal every render
  }, [permissions, sig]);
}

/**
 * Sepete-özel izin (jüri gibi — bkz. supabase/migrations/0026_jury_only_scoring.sql):
 * global PermissionsProvider'daki kataloğa girmez, çünkü basketId'ye göre değişir.
 * Yüklenene kadar (ve izin yoksa) false — "yetkisizken kontrol gizlensin" varsayılanı.
 */
export function useScopedPermission(key: Permission, basketId: string | null | undefined): boolean {
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    if (!basketId) {
      setAllowed(false);
      return;
    }
    let cancelled = false;
    void apiFetch<{ permissions: PermMap }>(`/api/permissions?keys=${key}&basketId=${basketId}`).then((res) => {
      if (!cancelled) setAllowed(res.data?.permissions?.[key] === true);
    });
    return () => {
      cancelled = true;
    };
  }, [key, basketId]);

  return allowed;
}
