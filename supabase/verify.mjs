// Live RLS / auth verification against a DEVELOPMENT Supabase project, using two real accounts.
//
//   node --env-file=.env.local supabase/verify.mjs
//
// Required env: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
//   MARTLET_TEST_A_EMAIL, MARTLET_TEST_A_PASSWORD, MARTLET_TEST_B_EMAIL, MARTLET_TEST_B_PASSWORD
// Both accounts must already exist and be email-confirmed (sign up via /signup first).
// Creates meetups titled "[verify] ..." and cancels them; rows are not deleted (no delete policy).
import { createClient } from "@supabase/supabase-js";

const env = (name) => {
  const value = process.env[name];
  if (!value) { console.error(`Missing env var ${name}`); process.exit(2); }
  return value;
};
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

let failures = 0;
const check = (name, cond, detail) => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${name}${cond ? "" : `  -> ${JSON.stringify(detail)}`}`);
  if (!cond) failures++;
};

async function signIn(prefix) {
  const supabase = client();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: env(`MARTLET_TEST_${prefix}_EMAIL`), password: env(`MARTLET_TEST_${prefix}_PASSWORD`),
  });
  if (error) { console.error(`Sign-in ${prefix} failed: ${error.message}`); process.exit(1); }
  return { supabase, id: data.user.id };
}

const anon = client();
const A = await signIn("A");
const B = await signIn("B");
check("two distinct test accounts", A.id !== B.id);

const { data: profiles } = await A.supabase.from("profiles").select("id, display_name").in("id", [A.id, B.id]);
check("profile trigger created both profiles", profiles?.length === 2, profiles);

const { data: places, error: placesError } = await anon.from("campus_locations").select("*");
check("migration 002 applied (campus_locations readable)", !placesError && places?.length > 0, placesError);
const place = places?.find((p) => p.id === "redpath-library") ?? places?.[0];

const future = new Date(Date.now() + 2 * 3600e3).toISOString();
const past = new Date(Date.now() - 3600e3).toISOString();
const meetup = (overrides = {}) => ({
  host_id: A.id, title: "[verify] Coffee at Redpath", description: "RLS verification",
  category: "coffee", location_name: place.name, latitude: place.latitude, longitude: place.longitude,
  starts_at: future, ...overrides,
});

let r = await anon.from("meetups").select("id").limit(1);
check("anonymous reads no meetups", !r.error && r.data.length === 0, r);
r = await anon.from("meetups").insert(meetup());
check("anonymous cannot create", Boolean(r.error), r);

r = await A.supabase.from("meetups").insert(meetup()).select("id").single();
check("A creates a meetup", !r.error, r);
const m1 = r.data?.id;
r = await A.supabase.from("meetups").insert(meetup({ host_id: B.id }));
check("A cannot create as B (impersonation)", Boolean(r.error), r);
r = await A.supabase.from("meetups").insert(meetup({ starts_at: past }));
check("past start time rejected", Boolean(r.error), r);
r = await A.supabase.from("meetups").insert(meetup({ latitude: 45.5, longitude: -73.6 }));
check("unapproved coordinates rejected", Boolean(r.error), r);
r = await A.supabase.from("meetups").insert(meetup({ status: "cancelled" }));
check("client cannot set status on insert", Boolean(r.error), r);

r = await B.supabase.from("meetups").select("id").eq("id", m1);
check("B sees A's meetup", r.data?.length === 1, r);
r = await B.supabase.from("meetups").update({ status: "cancelled" }).eq("id", m1).select("id");
check("B cannot cancel A's meetup via the API", !r.error ? r.data.length === 0 : true, r);
r = await A.supabase.from("meetups").update({ title: "Hijacked" }).eq("id", m1).select("id");
check("host cannot edit other columns", Boolean(r.error) || r.data.length === 0, r);

r = await B.supabase.from("meetup_pecks").insert({ meetup_id: m1, user_id: B.id });
check("B pecks", !r.error, r);
r = await B.supabase.from("meetup_pecks").insert({ meetup_id: m1, user_id: B.id });
check("duplicate peck rejected", Boolean(r.error), r);
r = await B.supabase.from("meetup_pecks").insert({ meetup_id: m1, user_id: A.id });
check("B cannot peck as A", Boolean(r.error), r);
r = await A.supabase.from("meetup_pecks").insert({ meetup_id: m1, user_id: A.id });
check("host cannot peck own meetup", Boolean(r.error), r);
r = await B.supabase.from("meetup_flaps").insert({ meetup_id: m1, user_id: B.id });
check("B flaps", !r.error, r);

r = await A.supabase.from("meetups")
  .select("id, host:profiles!host_id(display_name), pecks:meetup_pecks(count), flaps:meetup_flaps(count)")
  .eq("id", m1).single();
check("A sees 1 peck + 1 flap (attendee_count 2) via the service's select",
  !r.error && r.data.pecks[0].count === 1 && r.data.flaps[0].count === 1 && Boolean(r.data.host?.display_name), r);

r = await A.supabase.from("meetups").update({ status: "cancelled" }).eq("id", m1).eq("host_id", A.id).select("id");
check("host cancels own meetup", !r.error && r.data.length === 1, r);
r = await A.supabase.from("meetups").update({ status: "open" }).eq("id", m1).select("id");
check("host cannot re-open", Boolean(r.error) || r.data.length === 0, r);

await B.supabase.from("meetup_pecks").delete().eq("meetup_id", m1).eq("user_id", B.id);
r = await B.supabase.from("meetup_pecks").insert({ meetup_id: m1, user_id: B.id });
check("cannot peck a cancelled meetup", Boolean(r.error), r);

r = await B.supabase.from("meetups").select("id").eq("status", "open").eq("id", m1);
check("cancelled meetup is not in the open feed", r.data?.length === 0, r);

await Promise.all([A.supabase.auth.signOut(), B.supabase.auth.signOut()]);
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
