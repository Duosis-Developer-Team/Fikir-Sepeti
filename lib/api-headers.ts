"use client";

/**
 * Tarayıcı → kendi API'miz için başlıklar.
 *
 * Oturum artık httpOnly ÇEREZDE taşınıyor, `Authorization: Bearer` başlığında
 * değil. Yani JavaScript'in jetona erişimi yok — XSS ile oturum çalınamıyor.
 * Bu fonksiyon bu yüzden neredeyse boş; imzası KORUNDU çünkü 20'den fazla
 * çağrı noktası onu `await apiAuthHeaders(email, tenantId)` diye çağırıyor ve
 * hepsini değiştirmek gereksiz gürültü olurdu.
 *
 * Parametreler artık yalnızca CI/dev bypass'ında kullanılıyor.
 */
export async function apiAuthHeaders(
  email?: string,
  tenantId?: string | null
): Promise<Record<string, string>> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  // Test köprüsü: Playwright oturum açmadan kimlik taklit edebilsin.
  // Prod imajında NEXT_PUBLIC_AUTH_BYPASS ayarlanmaz.
  if (process.env.NEXT_PUBLIC_AUTH_BYPASS === "1" && email && tenantId) {
    headers["X-Dev-User"] = JSON.stringify({ email, tenantId });
  }

  return headers;
}

/**
 * API çağrıları için ince sarmalayıcı: çerezi her zaman gönderir ve JSON'u
 * çözer. `credentials: "same-origin"` varsayılan olsa da açıkça yazılıyor —
 * oturumun taşınması bu tek satıra bağlı.
 */
export async function apiFetch<T = unknown>(
  path: string,
  init?: RequestInit & { email?: string; tenantId?: string | null }
): Promise<{ ok: boolean; status: number; data: T | null; error?: string }> {
  const { email, tenantId, ...rest } = init ?? {};
  const headers = {
    ...(await apiAuthHeaders(email, tenantId)),
    ...(rest.headers as Record<string, string> | undefined),
  };

  let res: Response;
  try {
    res = await fetch(path, { ...rest, headers, credentials: "same-origin" });
  } catch (err) {
    // Ağ hatası: çağıranlar `ok:false` bekliyor, istisna değil.
    return { ok: false, status: 0, data: null, error: (err as Error).message };
  }

  const text = await res.text();
  let json: unknown = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch {
      json = null;
    }
  }

  if (!res.ok) {
    const error =
      (json as { error?: string } | null)?.error ?? `${res.status} ${res.statusText}`;
    return { ok: false, status: res.status, data: json as T | null, error };
  }
  return { ok: true, status: res.status, data: json as T };
}
