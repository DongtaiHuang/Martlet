// Seed a DEVELOPMENT Supabase project with demo meetups, pecks and flaps, using two real accounts.
//
//   node --env-file=.env supabase/seed.mjs
//
// Same env as verify.mjs: NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
//   MARTLET_TEST_A_EMAIL/PASSWORD, MARTLET_TEST_B_EMAIL/PASSWORD (confirmed accounts).
// Writes go through RLS as those users (no service-role key). Safe to re-run: a meetup is
// skipped if its host already has an open, upcoming meetup with the same title.
import { createClient } from "@supabase/supabase-js";

const env = (name) => {
  const value = process.env[name];
  if (!value) { console.error(`Missing env var ${name}`); process.exit(2); }
  return value;
};
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

// Never renames accounts: test accounts may be real people's (see issue #20).
async function signIn(prefix) {
  const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await supabase.auth.signInWithPassword({
    email: env(`MARTLET_TEST_${prefix}_EMAIL`), password: env(`MARTLET_TEST_${prefix}_PASSWORD`),
  });
  if (error) { console.error(`Sign-in ${prefix} failed: ${error.message}`); process.exit(1); }
  return { supabase, id: data.user.id };
}

const A = await signIn("A");
const B = await signIn("B");
if (A.id === B.id) { console.error("Test accounts A and B must be different users."); process.exit(1); }

const { data: places, error: placesError } = await A.supabase.from("campus_locations").select("id, name, latitude, longitude");
if (placesError || !places?.length) { console.error("Couldn't read campus_locations. Run the migrations first.", placesError); process.exit(1); }
const place = (id) => places.find((p) => p.id === id) ?? places[0];

const at = (days, hour, minute = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  d.setHours(hour, minute, 0, 0);
  if (d <= new Date()) d.setDate(d.getDate() + 1); // keep every start in the future
  return d.toISOString();
};

const SEED = [
  { host: A, title: "Coffee & a study break", category: "coffee", place: "redpath-library", starts_at: at(0, 15), description: "Grabbing coffee between classes. Meet at the front steps." },
  { host: A, title: "COMP 251 problem set session", category: "study", place: "trottier-building", starts_at: at(1, 18, 30), description: "Working through the problem set together. Bring questions!" },
  { host: A, title: "Pickup frisbee on lower field", category: "sports", place: "roddick-gates", starts_at: at(2, 17), description: "All levels welcome. Meet at the gates and walk over." },
  { host: A, title: "Board games night", category: "gaming", place: "university-centre", starts_at: at(4, 19), description: "Bringing Codenames and Catan." },
  { host: B, title: "Lunch after class?", category: "food", place: "burnside-hall", starts_at: at(1, 12, 30), description: "Heading to grab lunch nearby, anyone welcome." },
  { host: B, title: "Museum wander", category: "other", place: "redpath-museum", starts_at: at(3, 14), description: "Free entry. Let's check out the dinosaurs." },
  { host: B, title: "Quiet study at McLennan", category: "study", place: "mclennan-library", starts_at: at(5, 10), description: "Silent co-working for finals prep." },
];

const created = [];
for (const m of SEED) {
  const p = place(m.place);
  const { data: existing } = await m.host.supabase.from("meetups").select("id")
    .eq("host_id", m.host.id).eq("title", m.title).eq("status", "open").gt("starts_at", new Date().toISOString()).limit(1);
  if (existing?.length) { console.log(`skip    ${m.title}`); created.push({ ...m, id: existing[0].id }); continue; }

  const { data, error } = await m.host.supabase.from("meetups").insert({
    host_id: m.host.id, title: m.title, description: m.description, category: m.category,
    location_name: p.name, latitude: p.latitude, longitude: p.longitude, starts_at: m.starts_at,
  }).select("id").single();
  if (error) { console.error(`FAILED  ${m.title}: ${error.code} ${error.message}`); process.exitCode = 1; continue; }
  console.log(`create  ${m.title} @ ${p.name}`);
  created.push({ ...m, id: data.id });
}

// Cross-reactions: the other account pecks/flaps. Duplicates (23505) are fine on re-run.
const react = async (user, table, meetup) => {
  const { error } = await user.supabase.from(table).insert({ meetup_id: meetup.id, user_id: user.id });
  if (error && error.code !== "23505") { console.error(`FAILED  ${table} ${meetup.title}: ${error.message}`); process.exitCode = 1; }
};
for (const [i, m] of created.entries()) {
  const other = m.host === A ? B : A;
  if (i % 2 === 0) await react(other, "meetup_pecks", m);
  await react(other, "meetup_flaps", m);
}
console.log(`done: ${created.length} meetups with cross pecks/flaps`);
