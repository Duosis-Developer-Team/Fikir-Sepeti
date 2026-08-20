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

export const PERMISSION_LABELS: Record<Permission, { tr: string; desc: string }> = {
  "hackathon.create": { tr: "Hackathon açar", desc: "Yeni bir hackathon sepeti oluşturabilir." },
  "etkinlik.create": { tr: "Etkinlik açar", desc: "Yeni bir etkinlik sepeti oluşturabilir." },
  "pool.create": { tr: "Sepete fikir atar", desc: "Fikir havuzuna (Sepet) yeni fikir ekleyebilir." },
  "pool.promote": { tr: "Fikri organizasyona dönüştürür", desc: "Sepetteki fikirleri hackathon veya etkinliğe dönüştürebilir." },
  "content.moderate": { tr: "İçerik moderasyonu", desc: "İşaretlenen içerikleri inceleyip onaylayabilir/gizleyebilir." },
  "vote.view_all": { tr: "Tüm oyları görür", desc: "Kimin neye oy verdiğini görebilir." },
  "archive.view_all": { tr: "Tüm arşivi görür", desc: "Tenant'taki tüm biten sepetlerin arşivini görebilir." },
  "analytics.view": { tr: "Analitiği görür", desc: "Katılım ve üretim huni verilerini görebilir." },
  "tenant.manage_roles": { tr: "Rolleri yönetir", desc: "Kullanıcılara rol atayabilir/kaldırabilir." },
  "tenant.manage_settings": { tr: "Çalışma alanı ayarlarını yönetir", desc: "Tenant genel ayarlarını değiştirebilir." },
  "hackathon.jury": { tr: "Jüri olarak puanlar", desc: "Hackathon'da jüri puanı verebilir." },
  "hackathon.manage": { tr: "Hackathon'u yönetir", desc: "Faz ilerletme, takım/fikir düzenleme gibi organizatör işleri yapabilir." },
  "platform.manage_tenants": { tr: "Platformdaki tüm çalışma alanlarını yönetir", desc: "Platform paneline erişip tüm tenant'ları yönetebilir." },
};
