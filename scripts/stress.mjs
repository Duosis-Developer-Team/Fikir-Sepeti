// 40 sanal client — thundering herd + reconnect simülasyonu (Bölüm 11)
// Çalıştır: node scripts/stress.mjs <basket_id> <idea1,idea2,idea3>
// Env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY (.env.local'den export et)
import { createClient } from "@supabase/supabase-js";

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const BASKET = process.argv[2];
const IDEAS = (process.argv[3] ?? "").split(",").filter(Boolean);
const N = 40;

if (!URL || !KEY || !BASKET || IDEAS.length === 0) {
  console.error("Kullanım: node scripts/stress.mjs <basket_id> <idea1,idea2,...>");
  console.error("URL/KEY env'de tanımlı olmalı.");
  process.exit(1);
}

async function client(i) {
  const sb = createClient(URL, KEY);
  const ch = sb
    .channel("basket:" + BASKET)
    .on("postgres_changes", { event: "*", schema: "public", table: "ideas" }, () => {})
    .subscribe();

  await new Promise((r) => setTimeout(r, Math.random() * 500));
  const idea = IDEAS[Math.floor(Math.random() * IDEAS.length)];
  const t0 = Date.now();
  const { error } = await sb.from("votes").insert({
    basket_id: BASKET,
    idea_id: idea,
    phase: "voting",
    voter: "stress_" + i,
  });
  const ms = Date.now() - t0;
  if (error && error.code !== "23505") console.log(`client ${i} ERR ${ms}ms`, error.message);
  else console.log(`client ${i} ok ${ms}ms${error ? " (dup)" : ""}`);

  setTimeout(() => sb.removeChannel(ch), 2000);
}

console.time("all");
await Promise.all(Array.from({ length: N }, (_, i) => client(i)));
console.timeEnd("all");
setTimeout(() => process.exit(0), 2500);
