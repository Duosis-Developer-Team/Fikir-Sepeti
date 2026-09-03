import { resolveIdentity } from "@/lib/server/identity";
import { subscribe, type ChangeEvent } from "@/lib/server/realtime-hub";
import { withIdentity } from "@/lib/server/pg";

/**
 * GET /api/realtime — Server-Sent Events akışı.
 *
 * Supabase Realtime WebSocket'inin yerine. SSE seçilme sebebi: tek yönlü
 * (sunucu→istemci) bir akış için yeterli, tarayıcıda EventSource ile yerleşik
 * yeniden bağlanma geliyor ve ingress-nginx'ten WebSocket yükseltmesi
 * gerektirmeden geçiyor.
 *
 * Node runtime ZORUNLU: pg sürücüsü Edge'de çalışmıyor.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HEARTBEAT_MS = 25_000;

export async function GET(req: Request) {
  const identity = await resolveIdentity(req);
  if (!identity) {
    return new Response("unauthorized", { status: 401 });
  }

  // Gizlenmiş içeriği akışta görebilecek mi? Politikanın aynısı, tek seferlik.
  const canModerate = await withIdentity(identity.email, async (client) => {
    const res = await client.query<{ ok: boolean }>(
      "select public.has_perm('content.moderate') as ok"
    );
    return res.rows[0]?.ok === true;
  });

  const encoder = new TextEncoder();
  let unsubscribe: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const write = (chunk: string) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(chunk));
        } catch {
          // İstemci akışı kapattı; kapanış temizliği cancel()'da.
          closed = true;
        }
      };

      const send = (event: ChangeEvent) => {
        write(`event: change\ndata: ${JSON.stringify(event)}\n\n`);
      };

      try {
        unsubscribe = await subscribe({
          tenantId: identity.tenantId,
          canModerate,
          send,
        });
      } catch (err) {
        write(
          `event: error\ndata: ${JSON.stringify({
            message: (err as Error).message,
          })}\n\n`
        );
        controller.close();
        return;
      }

      // İstemci "bağlandım" diyebilsin: bu olay gelene kadar fallback polling
      // sürüyor (mevcut hook'ların SUBSCRIBED davranışıyla aynı).
      write(`event: ready\ndata: {"ok":true}\n\n`);

      // Yorum satırı heartbeat — ara katmanların (ingress, Cloudflare) boşta
      // kalan bağlantıyı kapatmasını engelliyor ve kopmuş bir soketi
      // yazma hatasıyla erken fark etmemizi sağlıyor.
      heartbeat = setInterval(() => write(`: ping\n\n`), HEARTBEAT_MS);
    },

    cancel() {
      unsubscribe?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // nginx SSE'yi varsayılan olarak tamponlar; bu başlık olmadan olaylar
      // istemciye ancak tampon dolunca ulaşır — yani "canlı" oylama canlı olmaz.
      "X-Accel-Buffering": "no",
    },
  });
}
