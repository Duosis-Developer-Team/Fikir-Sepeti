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
  duoTenant: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  otherTenant: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  etkinlik: "11111111-1111-4111-8111-111111111111",
  hackathon: "22222222-2222-4222-8222-222222222222",
  otherBasket: "55555555-5555-4555-8555-555555555555",
  ideaPizza: "33333333-3333-4333-8333-333333333333",
  ideaSushi: "44444444-4444-4444-8444-444444444444",
};

const ADMIN = "admin@duosis.dev";
const OTHER_ADMIN = "admin@other.com";

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
  await sb.from("team_votes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("team_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("teams").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("feedback").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("votes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("ideas").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("hackathon_participants").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("squad_members").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("baskets").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("app_users").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  // keep default DuoSis from migration; upsert Other Corp
}

async function main() {
  console.log("Seeding against", url);
  await wipe();

  const { error: tErr } = await sb.from("tenants").upsert(
    [
      {
        id: IDS.duoTenant,
        name: "DuoSis",
        email_domain: "duosis.dev",
        settings: {
          moderation: "warn",
          voteVisibility: "moderators",
          whoCanCreateHackathon: "organizers",
          whoCanCreateEvent: "everyone",
          whoCanPostToPool: "everyone",
        },
      },
      {
        id: IDS.otherTenant,
        name: "Other Corp",
        email_domain: "other.com",
        settings: {},
      },
    ],
    { onConflict: "id" }
  );
  if (tErr) throw tErr;

  const { error: uErr } = await sb.from("app_users").upsert(
    [
      {
        tenant_id: IDS.duoTenant,
        user_id: ADMIN,
        email: ADMIN,
        display_name: "Admin",
      },
      {
        tenant_id: IDS.otherTenant,
        user_id: OTHER_ADMIN,
        email: OTHER_ADMIN,
        display_name: "Other Admin",
      },
    ],
    { onConflict: "tenant_id,user_id" }
  );
  if (uErr) throw uErr;

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
      tenant_id: IDS.duoTenant,
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
      tenant_id: IDS.duoTenant,
    },
    {
      id: IDS.otherBasket,
      title: "Seed: Other Corp Secret",
      type: "etkinlik",
      resolve_method: "vote",
      phase: "ideas",
      status: "active",
      config: {},
      created_by: OTHER_ADMIN,
      tenant_id: IDS.otherTenant,
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
      tenant_id: IDS.duoTenant,
    },
    {
      id: IDS.ideaSushi,
      basket_id: IDS.etkinlik,
      text: "Sushi",
      created_by: "member@duosis.dev",
      vote_count: 0,
      tenant_id: IDS.duoTenant,
    },
  ]);
  if (iErr) throw iErr;

  console.log("Seed OK", IDS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
