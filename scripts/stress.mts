/**
 * 40 sanal istemci — realtime yolunun yük altındaki davranışı.
 *
 * Supabase Realtime yerine artık kendi SSE ucumuzu ve REST oy verme yolunu
 * zorluyor. Ölçtüğü şey aynı: bir oy, diğer istemcilere ne kadar sürede
 * ulaşıyor ve bağlantılar ayakta kalıyor mu.
 *
 * Çalıştır: NEXT_PUBLIC_AUTH_BYPASS=1 tsx scripts/stress.mts <basket_id> <idea1,idea2,...>
 * Env: BASE_URL (varsayılan http://127.0.0.1:3000), TENANT_ID
 */
const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const TENANT = process.env.TENANT_ID ?? "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const BASKET = process.argv[2];
const IDEAS = (process.argv[3] ?? "").split(",").filter(Boolean);
const N = Number(process.env.CLIENTS ?? 40);

if (!BASKET || IDEAS.length === 0) {
  console.error("Kullanım: tsx scripts/stress.mts <basket_id> <idea1,idea2,...>");
  process.exit(1);
}

const devHeader = (email: string) => ({
  "Content-Type": "application/json",
  "X-Dev-User": JSON.stringify({ email, tenantId: TENANT }),
});

let received = 0;
const latencies: number[] = [];

/** Bir istemci: SSE akışını dinler, sonra oy verir. */
async function client(i: number) {
  const email = `stress${i}@duosis.dev`;
  const res = await fetch(`${BASE}/api/realtime`, { headers: devHeader(email) });
  if (!res.ok || !res.body) {
    console.error(`client ${i}: SSE açılamadı (${res.status})`);
    return;
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  void (async () => {
    let buffer = "";
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE olayları boş satırla ayrılır.
      let idx: number;
      while ((idx = buffer.indexOf("\n\n")) >= 0) {
        const chunk = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        if (chunk.includes("event: change")) received++;
      }
    }
  })();

  // Akış kurulsun
  await new Promise((r) => setTimeout(r, 500));

  const idea = IDEAS[i % IDEAS.length];
  const started = Date.now();
  const vote = await fetch(`${BASE}/api/basket/${BASKET}/vote`, {
    method: "POST",
    headers: devHeader(email),
    body: JSON.stringify({ idea_id: idea, phase: "ideas" }),
  });
  if (vote.ok) latencies.push(Date.now() - started);
  else console.error(`client ${i}: oy reddedildi (${vote.status})`);

  return reader;
}

const readers = await Promise.all(Array.from({ length: N }, (_, i) => client(i)));
await new Promise((r) => setTimeout(r, 4000));

latencies.sort((a, b) => a - b);
const p50 = latencies[Math.floor(latencies.length * 0.5)] ?? 0;
const p95 = latencies[Math.floor(latencies.length * 0.95)] ?? 0;
console.log(`istemci=${N} oy=${latencies.length} alınan_olay=${received}`);
console.log(`oy gecikmesi p50=${p50}ms p95=${p95}ms`);

for (const r of readers) await r?.cancel().catch(() => {});
process.exit(0);
