/**
 * Create (or promote) a superadmin account.
 *
 *   node scripts/create-superadmin.mjs <email> <password> [displayName]
 *
 * Reads Supabase credentials from .env.local. Uses the service-role key to
 * create an email-confirmed user, then sets their profile role to
 * 'superadmin'. Idempotent — re-running updates the password and role.
 */
import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path = ".env.local") {
  const out = {};
  for (const line of fs.readFileSync(path, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#") || !t.includes("=")) continue;
    const i = t.indexOf("=");
    out[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
  return out;
}

const [, , email, password, displayName = "Super Admin"] = process.argv;
if (!email || !password) {
  console.error("Usage: node scripts/create-superadmin.mjs <email> <password> [displayName]");
  process.exit(1);
}

const env = loadEnv();
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey || url.includes("demo")) {
  console.error("Missing real Supabase credentials in .env.local");
  process.exit(1);
}

const sb = createClient(url, serviceKey, { auth: { persistSession: false } });

const { data: list } = await sb.auth.admin.listUsers({ perPage: 1000 });
let userId = list.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())?.id;

if (userId) {
  await sb.auth.admin.updateUserById(userId, { password, email_confirm: true });
  console.log("Updated existing user:", email);
} else {
  const { data, error } = await sb.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error) {
    console.error("createUser failed:", error.message);
    process.exit(1);
  }
  userId = data.user.id;
  console.log("Created user:", email);
}

// The handle_new_user trigger creates the profile; upsert ensures role.
const { error: roleErr } = await sb
  .from("profiles")
  .upsert({ id: userId, display_name: displayName, role: "superadmin" }, { onConflict: "id" });
if (roleErr) {
  console.error("Failed to set role:", roleErr.message);
  process.exit(1);
}

console.log("✅ Superadmin ready:", email, "(" + userId + ")");
