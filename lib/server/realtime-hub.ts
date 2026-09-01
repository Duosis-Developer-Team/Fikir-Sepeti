import "server-only";

import { Client } from "pg";

/**
 * Realtime dağıtıcısı — Supabase Realtime sunucusunun yerine.
 *
 * TEK bir Postgres bağlantısı `LISTEN fs_realtime` yapıyor ve gelen her
 * bildirimi süreç içindeki abonelere dağıtıyor. Abone başına bağlantı
 * açılmıyor: 30 kişilik bir hackathonda 30 boşta Postgres bağlantısı
 * demek olurdu ve tek düğümlü Postgres'in varsayılan 100 bağlantı sınırını
 * birkaç eşzamanlı sepette zorlardı.
 *
 * Dağıtım sınırı TENANT: bir abone yalnızca kendi tenant'ının olaylarını
 * görüyor. Bu, RLS'in okuma politikasıyla aynı sınır (tenant içi her şey
 * okunabilir) — yani SSE akışı, kullanıcının zaten SELECT edebileceğinden
 * fazlasını göstermiyor. Tek istisna gizlenmiş (hidden) sepet fikirleri;
 * onların satırı düşürülüp istemciye "yeniden çek" deniyor, çünkü onları
 * görmek content.moderate izni istiyor.
 */

export type ChangeEvent = {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  tenant_id: string | null;
  basket_id: string | null;
  row_id: string | null;
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
  truncated?: boolean;
};

type Subscriber = {
  tenantId: string;
  canModerate: boolean;
  send: (event: ChangeEvent) => void;
};

const globalForHub = globalThis as unknown as {
  _fsHub?: {
    client: Client | null;
    subscribers: Set<Subscriber>;
    connecting: Promise<void> | null;
    retryMs: number;
  };
};

function hub() {
  if (!globalForHub._fsHub) {
    globalForHub._fsHub = {
      client: null,
      subscribers: new Set(),
      connecting: null,
      retryMs: 1000,
    };
  }
  return globalForHub._fsHub;
}

function dispatch(payload: string) {
  let event: ChangeEvent;
  try {
    event = JSON.parse(payload) as ChangeEvent;
  } catch {
    console.warn("fs_realtime: çözümlenemeyen payload");
    return;
  }

  const h = hub();
  for (const sub of h.subscribers) {
    if (!event.tenant_id || event.tenant_id !== sub.tenantId) continue;

    // Gizlenmiş sepet fikri: satırı moderatör olmayana verme. Olayın kendisi
    // (bir şey değişti) zararsız; istemci yeniden çekince RLS doğru kararı
    // zaten veriyor.
    const row = (event.new ?? event.old) as { hidden?: boolean } | null | undefined;
    if (event.table === "idea_pool" && row?.hidden === true && !sub.canModerate) {
      sub.send({ ...event, new: null, old: null, truncated: true });
      continue;
    }

    sub.send(event);
  }
}

async function ensureListening(): Promise<void> {
  const h = hub();
  if (h.client) return;
  if (h.connecting) return h.connecting;

  h.connecting = (async () => {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("DATABASE_URL yok — realtime dinleyicisi başlatılamıyor");

    const client = new Client({
      connectionString: url,
      ssl: process.env.PGSSLMODE === "require" ? { rejectUnauthorized: false } : undefined,
    });

    client.on("notification", (msg) => {
      if (msg.channel === "fs_realtime" && msg.payload) dispatch(msg.payload);
    });

    // Bağlantı düşerse (Postgres yeniden başladı, ağ koptu) sessizce ölmemeli:
    // istemciler açık SSE akışlarını "çalışıyor" sanıp güncelleme beklerdi.
    // Temizlenip yeniden kuruluyor; istemci tarafındaki fallback polling
    // (useRealtimeVotes/useRealtimePool) bu aralığı zaten kapatıyor.
    client.on("error", (err) => {
      console.error("fs_realtime dinleyici hatası:", err.message);
      hub().client = null;
      client.end().catch(() => {});
      scheduleReconnect();
    });
    client.on("end", () => {
      if (hub().client === client) {
        hub().client = null;
        scheduleReconnect();
      }
    });

    await client.connect();
    await client.query("listen fs_realtime");
    h.client = client;
    h.retryMs = 1000;
    console.log("fs_realtime dinleyicisi bağlandı");
  })();

  try {
    await h.connecting;
  } finally {
    h.connecting = null;
  }
}

function scheduleReconnect() {
  const h = hub();
  if (h.subscribers.size === 0) return; // kimse dinlemiyorsa uğraşma
  const delay = Math.min(h.retryMs, 30_000);
  h.retryMs = delay * 2;
  setTimeout(() => {
    ensureListening().catch((err) =>
      console.error("fs_realtime yeniden bağlanamadı:", err.message)
    );
  }, delay);
}

export async function subscribe(sub: Subscriber): Promise<() => void> {
  const h = hub();
  h.subscribers.add(sub);
  try {
    await ensureListening();
  } catch (err) {
    h.subscribers.delete(sub);
    throw err;
  }
  return () => {
    h.subscribers.delete(sub);
  };
}

export function subscriberCount(): number {
  return hub().subscribers.size;
}
