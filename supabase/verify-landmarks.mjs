// Live check of landmark unlocks + photo Storage rules (migration 006) on a DEVELOPMENT project.
//
//   node --env-file=.env.local supabase/verify-landmarks.mjs
//
// Same env as verify.mjs (two confirmed test accounts). Uses the landmark "leacock-building".
// Unlocks are permanent, so after the first run A and B stay unlocked; the script handles that.
import { createClient } from "@supabase/supabase-js";

const env = (name) => {
  const value = process.env[name];
  if (!value) { console.error(`Missing env var ${name}`); process.exit(2); }
  return value;
};
const url = env("NEXT_PUBLIC_SUPABASE_URL");
const key = env("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const BUCKET = "landmark-photos";
const L = "leacock-building";

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
// Smallest valid JPEG header + EOI is enough for Storage's MIME/size checks.
const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0xff, 0xd9]);
const upload = (who, path, upsert = true) =>
  who.supabase.storage.from(BUCKET).upload(path, jpeg, { contentType: "image/jpeg", upsert });

const A = await signIn("A");
const B = await signIn("B");

let r = await A.supabase.from("landmarks").select("id");
check("migration 006 applied (landmarks readable)", !r.error && r.data.length >= 6, r.error);

// A unlocks (row first, then photo), or modifies if already unlocked from an earlier run.
r = await A.supabase.from("landmark_unlocks").select("user_id").eq("landmark_id", L).eq("user_id", A.id).maybeSingle();
if (!r.data) {
  r = await A.supabase.from("landmark_unlocks").insert({ user_id: A.id, landmark_id: L, caption: "[verify] A" });
  check("A unlocks landmark", !r.error, r.error);
}
r = await upload(A, `${A.id}/${L}.jpg`);
check("A uploads/replaces own photo (upsert)", !r.error, r.error);
r = await A.supabase.from("landmark_unlocks").update({ caption: "[verify] A edited" }).eq("landmark_id", L).eq("user_id", A.id).select("caption");
check("A modifies own caption", !r.error && r.data.length === 1, r);

r = await A.supabase.from("landmark_unlocks").delete().eq("landmark_id", L).eq("user_id", A.id).select("user_id");
check("A cannot delete own unlock", Boolean(r.error) || r.data.length === 0, r);
r = await A.supabase.storage.from(BUCKET).remove([`${A.id}/${L}.jpg`]);
r = await A.supabase.storage.from(BUCKET).createSignedUrl(`${A.id}/${L}.jpg`, 60);
check("A cannot delete own photo (still signable)", !r.error, r.error);
r = await A.supabase.storage.from(BUCKET).move(`${A.id}/${L}.jpg`, `${A.id}/old-port.jpg`);
check("A cannot move photo to a landmark not unlocked", Boolean(r.error), r);

r = await upload(A, `${B.id}/${L}.jpg`);
check("A cannot upload into B's folder", Boolean(r.error), r);
r = await A.supabase.storage.from(BUCKET).upload(`${A.id}/x.png`, jpeg, { contentType: "image/png" });
check("non-JPEG / bad path rejected", Boolean(r.error), r);

const bUnlocked = (await B.supabase.from("landmark_unlocks").select("user_id").eq("landmark_id", L).eq("user_id", B.id).maybeSingle()).data;
if (!bUnlocked) {
  r = await B.supabase.storage.from(BUCKET).createSignedUrl(`${A.id}/${L}.jpg`, 60);
  check("B (locked) cannot sign A's photo", Boolean(r.error), r);
  r = await B.supabase.from("landmark_unlocks").select("user_id").eq("landmark_id", L);
  check("B (locked) sees no unlocks", !r.error && r.data.length === 0, r);
  r = await B.supabase.from("landmark_unlocks").insert({ user_id: B.id, landmark_id: L, caption: "[verify] B" });
  check("B unlocks landmark", !r.error, r.error);
  await upload(B, `${B.id}/${L}.jpg`);
} else {
  console.log("(B already unlocked from an earlier run; skipping locked-state checks)");
}
r = await B.supabase.storage.from(BUCKET).createSignedUrl(`${A.id}/${L}.jpg`, 60);
check("B (unlocked) can sign A's photo", !r.error, r.error);
r = await B.supabase.from("landmark_unlocks").select("user_id").eq("landmark_id", L).in("user_id", [A.id, B.id]);
check("B sees both unlocks", !r.error && r.data.length === 2, r);
r = await B.supabase.from("landmark_unlocks").update({ caption: "pwned" }).eq("user_id", A.id).eq("landmark_id", L).select("user_id");
check("B cannot edit A's caption", Boolean(r.error) || r.data.length === 0, r);
r = await upload(B, `${A.id}/${L}.jpg`);
check("B cannot overwrite A's photo", Boolean(r.error), r);
r = await B.supabase.rpc("landmark_unlock_counts");
check("unlock counts available", !r.error && Number(r.data.find((x) => x.landmark_id === L)?.unlock_count) >= 2, r);

await Promise.all([A.supabase.auth.signOut(), B.supabase.auth.signOut()]);
console.log(failures ? `\n${failures} FAILED` : "\nALL PASSED");
process.exit(failures ? 1 : 0);
