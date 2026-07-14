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
  poolIdea: "66666666-6666-4666-8666-666666666666",
  poolPollA: "77777777-7777-4777-8777-777777777777",
  poolPollB: "88888888-8888-4888-8888-888888888888",
  archiveEtkinlik: "99999999-9999-4999-8999-999999999999",
  archiveHackathon: "aaaa1111-1111-4111-8111-111111111111",
  archiveIdeaWin: "bbbb2222-2222-4222-8222-222222222222",
  archiveIdeaLose: "cccc3333-3333-4333-8333-333333333333",
  archiveHackIdea: "dddd4444-4444-4444-8444-444444444444",
  archiveTeam: "eeee5555-5555-4555-8555-555555555555",
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
  await sb.from("pool_votes").delete().neq("id", "00000000-0000-0000-0000-000000000000");
  await sb.from("idea_pool").delete().neq("id", "00000000-0000-0000-0000-000000000000");
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
    {
      id: IDS.archiveEtkinlik,
      title: "Seed: Arşiv Etkinlik",
      type: "etkinlik",
      resolve_method: "vote",
      phase: "resolved",
      status: "resolved",
      config: {},
      created_by: ADMIN,
      tenant_id: IDS.duoTenant,
    },
    {
      id: IDS.archiveHackathon,
      title: "Seed: Arşiv Hackathon",
      type: "hackathon",
      resolve_method: "vote",
      phase: "done",
      status: "resolved",
      config: { ideaSource: "static", teamMode: "solo" },
      created_by: ADMIN,
      tenant_id: IDS.duoTenant,
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
    {
      id: IDS.archiveIdeaWin,
      basket_id: IDS.archiveEtkinlik,
      text: "Arşiv kazanan fikir",
      created_by: ADMIN,
      vote_count: 5,
      tenant_id: IDS.duoTenant,
    },
    {
      id: IDS.archiveIdeaLose,
      basket_id: IDS.archiveEtkinlik,
      text: "Arşiv kaybeden fikir",
      created_by: "member@duosis.dev",
      vote_count: 2,
      tenant_id: IDS.duoTenant,
    },
    {
      id: IDS.archiveHackIdea,
      basket_id: IDS.archiveHackathon,
      text: "Arşiv hackathon fikri",
      created_by: ADMIN,
      vote_count: 3,
      tenant_id: IDS.duoTenant,
    },
  ]);
  if (iErr) throw iErr;

  await sb
    .from("baskets")
    .update({ winner_idea_id: IDS.archiveIdeaWin })
    .eq("id", IDS.archiveEtkinlik);
  await sb
    .from("baskets")
    .update({
      selected_idea_id: IDS.archiveHackIdea,
      winner_idea_id: IDS.archiveHackIdea,
    })
    .eq("id", IDS.archiveHackathon);

  await sb.from("votes").insert([
    {
      idea_id: IDS.archiveIdeaWin,
      basket_id: IDS.archiveEtkinlik,
      phase: "ideas",
      voter: ADMIN,
      tenant_id: IDS.duoTenant,
    },
    {
      idea_id: IDS.archiveIdeaWin,
      basket_id: IDS.archiveEtkinlik,
      phase: "ideas",
      voter: "member@duosis.dev",
      tenant_id: IDS.duoTenant,
    },
  ]);

  await sb.from("hackathon_participants").insert([
    {
      basket_id: IDS.archiveHackathon,
      user_id: ADMIN,
      email: ADMIN,
      display_name: "Admin",
      role: "admin",
      tenant_id: IDS.duoTenant,
    },
    {
      basket_id: IDS.archiveHackathon,
      user_id: "member@duosis.dev",
      email: "member@duosis.dev",
      display_name: "Member",
      role: "member",
      tenant_id: IDS.duoTenant,
    },
  ]);

  await sb.from("teams").insert({
    id: IDS.archiveTeam,
    basket_id: IDS.archiveHackathon,
    name: "Squad Alpha",
    tenant_id: IDS.duoTenant,
  });
  await sb.from("team_members").insert({
    team_id: IDS.archiveTeam,
    basket_id: IDS.archiveHackathon,
    user_id: ADMIN,
    tenant_id: IDS.duoTenant,
  });
  await sb.from("team_votes").insert({
    team_id: IDS.archiveTeam,
    basket_id: IDS.archiveHackathon,
    voter: "member@duosis.dev",
    tenant_id: IDS.duoTenant,
  });
  await sb.from("feedback").insert({
    basket_id: IDS.archiveHackathon,
    team_id: IDS.archiveTeam,
    author_id: ADMIN,
    author_name: "Admin",
    text: "Harika demo",
    tenant_id: IDS.duoTenant,
  });

  const pollCloses = new Date(Date.now() + 24 * 3600_000).toISOString();
  const { error: poolErr } = await sb.from("idea_pool").insert([
    {
      id: IDS.poolIdea,
      tenant_id: IDS.duoTenant,
      text: "Seed: Ofis ruhu iyileştirme",
      brief: "Kavanoz örnek fikir",
      category: "kültür",
      status: "new",
      created_by: ADMIN,
      vote_count: 0,
    },
    {
      id: IDS.poolPollA,
      tenant_id: IDS.duoTenant,
      text: "Seed Poll: Kahve makinesi",
      brief: "Poll seçeneği A",
      category: "ürün",
      status: "voting",
      poll_closes_at: pollCloses,
      created_by: ADMIN,
      vote_count: 0,
    },
    {
      id: IDS.poolPollB,
      tenant_id: IDS.duoTenant,
      text: "Seed Poll: Ayakta masa",
      brief: "Poll seçeneği B",
      category: "ürün",
      status: "voting",
      poll_closes_at: pollCloses,
      created_by: ADMIN,
      vote_count: 0,
    },
  ]);
  if (poolErr) throw poolErr;

  // Roles (system ids from 0004_rbac)
  const ROLE = {
    tenant_admin: "c0000000-0000-4000-8000-000000000002",
    organizer: "c0000000-0000-4000-8000-000000000004",
    member: "c0000000-0000-4000-8000-000000000006",
  };

  await sb.from("app_users").upsert(
    {
      tenant_id: IDS.duoTenant,
      user_id: "member@duosis.dev",
      email: "member@duosis.dev",
      display_name: "Member",
    },
    { onConflict: "tenant_id,user_id" }
  );

  await sb.from("user_roles").delete().neq("id", "00000000-0000-0000-0000-000000000000");

  const roleRows = [
    { tenant_id: IDS.duoTenant, user_id: ADMIN, role_id: ROLE.member },
    { tenant_id: IDS.duoTenant, user_id: ADMIN, role_id: ROLE.organizer },
    { tenant_id: IDS.duoTenant, user_id: ADMIN, role_id: ROLE.tenant_admin },
    { tenant_id: IDS.duoTenant, user_id: "member@duosis.dev", role_id: ROLE.member },
    { tenant_id: IDS.otherTenant, user_id: OTHER_ADMIN, role_id: ROLE.member },
    { tenant_id: IDS.otherTenant, user_id: OTHER_ADMIN, role_id: ROLE.organizer },
  ];
  const { error: rErr } = await sb.from("user_roles").insert(roleRows);
  if (rErr) throw rErr;

  // Auth users for RLS (JWT) — password shared with AuthGate DEV_AUTH_PASSWORD
  const DEV_PASSWORD = process.env.NEXT_PUBLIC_DEV_AUTH_PASSWORD || "test-password-123";
  const authEmails = [ADMIN, "member@duosis.dev", OTHER_ADMIN];
  for (const email of authEmails) {
    const { data: listed } = await sb.auth.admin.listUsers({ page: 1, perPage: 200 });
    const existing = listed?.users?.find((u) => u.email === email);
    if (existing) {
      await sb.auth.admin.updateUserById(existing.id, {
        password: DEV_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { error: aErr } = await sb.auth.admin.createUser({
        email,
        password: DEV_PASSWORD,
        email_confirm: true,
      });
      if (aErr) console.warn("auth create", email, aErr.message);
    }
  }

  console.log("Seed OK", IDS);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
