#!/usr/bin/env node
/**
 * Write .env.local from local `supabase status` for Next + Playwright.
 */
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const out = execSync("npx supabase status -o env", {
  encoding: "utf8",
  stdio: ["ignore", "pipe", "pipe"],
});

const map = {};
for (const line of out.split("\n")) {
  const m = line.match(/^([A-Z0-9_]+)=("?)(.*)\2$/);
  if (m) map[m[1]] = m[3];
}

const apiUrl = map.API_URL || map.SUPABASE_URL;
const anon = map.ANON_KEY || map.SUPABASE_ANON_KEY;
const service = map.SERVICE_ROLE_KEY || map.SUPABASE_SERVICE_ROLE_KEY;

if (!apiUrl || !anon) {
  console.error("Could not parse supabase status env. Is `supabase start` running?");
  process.exit(1);
}

const env = [
  `NEXT_PUBLIC_SUPABASE_URL=${apiUrl}`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
  `SUPABASE_SERVICE_ROLE_KEY=${service ?? ""}`,
  `NEXT_PUBLIC_AUTH_BYPASS=1`,
  "",
].join("\n");

writeFileSync(".env.local", env);
console.log("Wrote .env.local from supabase status");
