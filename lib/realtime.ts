"use client";

/**
 * İstemci realtime — `supabase.channel(...).on("postgres_changes", ...)` yerine.
 *
 * Şekil BİLEREK Supabase'inkine yakın tutuldu (`eventType` / `new` / `old`),
 * çünkü 12 aboneliğin ikisi payload'ı doğrudan kullanıyor (useRealtimeVotes
 * satır listesini yerinde günceller). Böylece o mantık yeniden yazılmıyor.
 *
 * TEK EventSource: tarayıcı aynı origin'e HTTP/1.1 üzerinde ~6 eşzamanlı
 * bağlantıya izin veriyor. Ana sayfa + sepet + havuz hook'ları aynı anda
 * açıkken abonelik başına bir bağlantı açmak, sayfanın geri kalanının
 * isteklerini (fetch'ler dahil) sıraya sokardı. Onun yerine tek akış
 * açılıyor ve dağıtım burada yapılıyor.
 */

export type ChangePayload = {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  tenant_id: string | null;
  basket_id: string | null;
  row_id: string | null;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
  /** Satır 8KB sınırına takıldı ya da izin gerektiriyor → yeniden çek. */
  truncated?: boolean;
};

export type ChangeFilter = {
  table: string;
  /** `basket_id=eq.X` yerine: { column: "basket_id", value: X } */
  column?: "basket_id" | "tenant_id" | "id";
  value?: string;
};

export type Subscription = {
  filters: ChangeFilter[];
  onChange: (payload: ChangePayload) => void;
  onStatus?: (connected: boolean) => void;
};

type Registered = Subscription & { id: number };

let source: EventSource | null = null;
let nextId = 1;
const subscriptions = new Map<number, Registered>();
let connected = false;

function matches(sub: Registered, payload: ChangePayload): boolean {
  return sub.filters.some((f) => {
    if (f.table !== payload.table) return false;
    if (!f.column || !f.value) return true;
    if (f.column === "id") return payload.row_id === f.value;
    if (f.column === "basket_id") return payload.basket_id === f.value;
    if (f.column === "tenant_id") return payload.tenant_id === f.value;
    return false;
  });
}

function broadcastStatus(next: boolean) {
  if (connected === next) return;
  connected = next;
  for (const sub of subscriptions.values()) sub.onStatus?.(next);
}

function ensureSource() {
  if (source || typeof window === "undefined") return;

  const es = new EventSource("/api/realtime", { withCredentials: true });
  source = es;

  es.addEventListener("ready", () => broadcastStatus(true));

  es.addEventListener("change", (event) => {
    let payload: ChangePayload;
    try {
      payload = JSON.parse((event as MessageEvent).data) as ChangePayload;
    } catch {
      return;
    }
    for (const sub of subscriptions.values()) {
      if (matches(sub, payload)) {
        try {
          sub.onChange(payload);
        } catch (err) {
          // Bir abonenin hatası diğerlerinin olayı almasını engellememeli.
          console.error("realtime abone hatası:", err);
        }
      }
    }
  });

  es.addEventListener("error", () => {
    // EventSource kendi kendine yeniden bağlanıyor; burada sadece durumu
    // düşürüyoruz ki hook'lar fallback polling'e geçsin (mevcut davranış).
    broadcastStatus(false);
  });
}

function teardownIfIdle() {
  if (subscriptions.size > 0 || !source) return;
  source.close();
  source = null;
  connected = false;
}

/** Abone ol; dönen fonksiyon aboneliği kaldırır. */
export function subscribeChanges(sub: Subscription): () => void {
  const id = nextId++;
  const registered: Registered = { ...sub, id };
  subscriptions.set(id, registered);
  ensureSource();
  // Akış zaten açıksa yeni abone "bağlı" durumunu hemen öğrensin.
  if (connected) sub.onStatus?.(true);
  return () => {
    subscriptions.delete(id);
    teardownIfIdle();
  };
}

/** Test/teşhis için: kaç abonelik açık. */
export function activeSubscriptionCount(): number {
  return subscriptions.size;
}
