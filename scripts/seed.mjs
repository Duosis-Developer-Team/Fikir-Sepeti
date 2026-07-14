#!/usr/bin/env node
/**
 * Deterministic seed for local / CI tests.
 * Fixed UUIDs so Playwright helpers can deep-link when needed.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/seed.mjs
 *   (or after `supabase start` — reads from `npx supabase status -o env`)
 */
import { createClient } from "@supabase/supabase-js";
import { execSync } from "node:child_process";

const IDS = {
  etkinlik: "11111111-1111-4111-8111-111111111111",
  hackathon: "22222222-2222-4222-8222-222222222222",
  ideaPizza: "33333333-3333-4333-8333-333333333333",
  ideaSushi: "44444444-4444-4444-8444-444444444444",
};

const ADMIN = "admin@duosis.dev";

function statusEnv() {
  try {
    const out = execSync("npx supabase status -o env", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    const map = {};
    for (const line of out.split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=("?)(.*)\2$/);
      if (m) map[m[1]] = m[3];
    }
    return map;
  } catch {
    return {};
  }
}

const status = statusEnv();
const url =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  status.API_URL ||
  status.SUPABASE_URL;
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  status.SERVICE_ROLE_KEY ||
  status.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error(
    "Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (or run `supabase start` first)."
  );
  process.exit(1);
}

const sb = createClient(url, serviceKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function wipe() {
  // order respects FKs
  await sb.from("team_votes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("team_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("feedback").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("ideas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("hackathon_participants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("squad_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("baskets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
}

async function main() {
  console.log("Seeding against", url);
  await wipe();

  const { error: bErr } = await sb.from("baskets").insert([
    {
      id: IDS.etkinlik,
      title: "Seed: Akşam nereye?",
      type: "etkinlik",
      resolve_method: "vote",
      phase: "ideas",
      status: "active",
      config: {},
      created_by: ADMIN,
    },
    {
      id: IDS.hackathon,
      title: "Seed: İç Hackathon",
      type: "hackathon",
      resolve_method: "vote",
      phase: "lobby",
      status: "active",
      config: {},
      created_by: ADMIN,
    },
  ]);
  if (bErr) throw bErr;

  const { error: iErr } = await sb.from("ideas").insert([
    {
      id: IDS.ideaPizza,
      basket_id: IDS.etkinlik,
      text: "Pizza",
      created_by: ADMIN,
      vote_count: 0,
    },
    {
      id: IDS.ideaSushi,
      basket_id: IDS.etkinlik,
      text: "Sushi",
      created_by: "member@duosis.dev",
      vote_count: 0,
    },
  ]);
  if (iErr) throw iErr;

  console.log("Seed OK", IDS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
