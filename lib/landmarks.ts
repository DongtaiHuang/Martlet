import type { LandmarkDetail, LandmarkPhoto, LandmarkSummary, MyUnlock } from "@/types/landmark";
import { getMockLandmarks } from "@/lib/mock-landmarks";
import { AuthRequiredError, MockModeError } from "@/lib/meetups";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/auth";

// Server-only landmark service (ADR 0009, phase 1: honour-system unlocks).
// Same data-mode rules as lib/meetups.ts: mock mode returns lib/mock-landmarks.ts
// (everything locked, no photos) and refuses writes; live mode never falls back to mock.
// RLS in supabase/migrations/006_landmarks.sql is the real enforcement.

export { AuthRequiredError, MockModeError };

export class LandmarkValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandmarkValidationError";
  }
}

export class LandmarkNotFoundError extends Error {
  constructor(message = "Landmark not found.") {
    super(message);
    this.name = "LandmarkNotFoundError";
  }
}

/** The unlock/caption was saved but the photo upload failed; retrying the photo is safe. */
export class LandmarkPhotoUploadError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LandmarkPhotoUploadError";
  }
}

export const CAPTION_MAX = 200;
/** Photos are resized in the browser to ~1280 px JPEG, normally well under 1 MB. */
export const PHOTO_MAX_BYTES = 4 * 1024 * 1024;

const BUCKET = "landmark-photos";
const SIGNED_URL_SECONDS = 60 * 60;
const LANDMARK_ID_PATTERN = /^[a-z0-9-]{2,40}$/;
const LANDMARK_COLUMNS = "id, name, latitude, longitude, radius_m, challenge_prompt, description";
const UNLOCK_SELECT = "user_id, caption, photo_path, created_at, updated_at, author:profiles!user_id(display_name)";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;
type LandmarkRow = Omit<LandmarkSummary, "unlock_count" | "unlocked">;
type UnlockRow = {
  user_id: string;
  caption: string;
  photo_path: string;
  created_at: string;
  updated_at: string;
  author: { display_name: string } | { display_name: string }[] | null;
};

async function currentUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims?.sub ?? null);
}

async function unlockCounts(supabase: SupabaseServerClient): Promise<Map<string, number>> {
  const { data, error } = await supabase.rpc("landmark_unlock_counts");
  if (error) throw new Error(`Failed to load unlock counts: ${error.message}`);
  const rows = (data ?? []) as { landmark_id: string; unlock_count: number | string }[];
  return new Map(rows.map((row) => [row.landmark_id, Number(row.unlock_count)]));
}

/** Signs photo URLs in one request. Missing files (e.g. a failed upload) map to null. */
async function signPhotos(supabase: SupabaseServerClient, paths: string[]): Promise<Map<string, string | null>> {
  if (paths.length === 0) return new Map();
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error) throw new Error(`Failed to load photos: ${error.message}`);
  return new Map(data.map((item) => [item.path ?? "", item.error ? null : item.signedUrl]));
}

function toPhoto(row: UnlockRow, urls: Map<string, string | null>, userId: string): LandmarkPhoto {
  const author = Array.isArray(row.author) ? row.author[0] : row.author;
  return {
    user_id: row.user_id,
    display_name: author?.display_name ?? "Martlet Student",
    caption: row.caption,
    photo_url: urls.get(row.photo_path) ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    is_mine: row.user_id === userId,
  };
}

function isJpeg(bytes: Uint8Array): boolean {
  return bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
}

/** All landmarks with unlock counts and whether the current user unlocked each. Guests: nothing unlocked. */
export async function listLandmarks(): Promise<LandmarkSummary[]> {
  if (getDataMode() === "mock") return getMockLandmarks();

  const supabase = await createClient();
  const userId = await currentUserId(supabase);

  const [landmarks, counts, mine] = await Promise.all([
    // Hidden landmarks (ADR 0049) leave maps and lists; their existing unlocks stay.
    supabase.from("landmarks").select(LANDMARK_COLUMNS).eq("hidden", false).order("name").returns<LandmarkRow[]>(),
    unlockCounts(supabase),
    userId
      ? supabase.from("landmark_unlocks").select("landmark_id").eq("user_id", userId)
      : Promise.resolve({ data: [] as { landmark_id: string }[], error: null }),
  ]);
  if (landmarks.error) throw new Error(`Failed to load landmarks: ${landmarks.error.message}`);
  if (mine.error) throw new Error(`Failed to load your unlocks: ${mine.error.message}`);

  const unlocked = new Set(mine.data.map((row) => row.landmark_id as string));
  return landmarks.data.map((landmark) => ({
    ...landmark,
    unlock_count: counts.get(landmark.id) ?? 0,
    unlocked: unlocked.has(landmark.id),
  }));
}

/** One landmark plus the current user's own unlock (with a signed photo URL). */
export async function getLandmark(id: string): Promise<LandmarkDetail | null> {
  if (getDataMode() === "mock") {
    const landmark = getMockLandmarks().find((l) => l.id === id);
    return landmark ? { ...landmark, my_unlock: null } : null;
  }
  if (!LANDMARK_ID_PATTERN.test(id)) return null;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);

  const [landmark, counts, mine] = await Promise.all([
    supabase.from("landmarks").select(LANDMARK_COLUMNS).eq("id", id).maybeSingle<LandmarkRow>(),
    unlockCounts(supabase),
    userId
      ? supabase.from("landmark_unlocks").select(UNLOCK_SELECT).eq("landmark_id", id).eq("user_id", userId).maybeSingle<UnlockRow>()
      : Promise.resolve({ data: null as UnlockRow | null, error: null }),
  ]);
  if (landmark.error) throw new Error(`Failed to load landmark: ${landmark.error.message}`);
  if (mine.error) throw new Error(`Failed to load your unlock: ${mine.error.message}`);
  if (!landmark.data) return null;

  const urls = mine.data ? await signPhotos(supabase, [mine.data.photo_path]) : new Map();
  return {
    ...landmark.data,
    unlock_count: counts.get(id) ?? 0,
    unlocked: Boolean(mine.data),
    my_unlock: mine.data ? toPhoto(mine.data, urls, userId ?? "") : null,
  };
}

/** The current user's own unlocks in the order they were made, with signed photo URLs. */
export async function listMyUnlocks(): Promise<MyUnlock[]> {
  if (getDataMode() === "mock") return [];

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("landmark_unlocks")
    .select("landmark_id, caption, photo_path, created_at, landmark:landmarks(name)")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .returns<{
      landmark_id: string;
      caption: string;
      photo_path: string;
      created_at: string;
      landmark: { name: string } | { name: string }[] | null;
    }[]>();
  if (error) throw new Error(`Failed to load your unlocks: ${error.message}`);

  const urls = await signPhotos(supabase, data.map((row) => row.photo_path));
  return data.map((row) => {
    const landmark = Array.isArray(row.landmark) ? row.landmark[0] : row.landmark;
    return {
      landmark_id: row.landmark_id,
      landmark_name: landmark?.name ?? row.landmark_id,
      caption: row.caption,
      photo_url: urls.get(row.photo_path) ?? null,
      created_at: row.created_at,
    };
  });
}

/** Everyone's photos for a landmark, newest first. RLS returns nothing until you've unlocked it. */
export async function listLandmarkPhotos(id: string): Promise<LandmarkPhoto[]> {
  if (getDataMode() === "mock" || !LANDMARK_ID_PATTERN.test(id)) return [];

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("landmark_unlocks")
    .select(UNLOCK_SELECT)
    .eq("landmark_id", id)
    .order("created_at", { ascending: false })
    .limit(200)
    .returns<UnlockRow[]>();
  if (error) throw new Error(`Failed to load photos: ${error.message}`);

  const urls = await signPhotos(supabase, data.map((row) => row.photo_path));
  return data.map((row) => toPhoto(row, urls, userId));
}

/**
 * Creates or modifies the current user's unlock. Creating requires a photo; modifying can
 * change the caption, replace the photo, or both. Unlocks can never be deleted (ADR 0009).
 * Throws AuthRequiredError, LandmarkValidationError, LandmarkNotFoundError, or MockModeError.
 */
export async function saveUnlock(
  landmarkId: string,
  input: { photo: Blob | null; caption: string },
): Promise<void> {
  if (getDataMode() === "mock") throw new MockModeError("unlock a landmark");
  if (!LANDMARK_ID_PATTERN.test(landmarkId)) throw new LandmarkNotFoundError();

  const caption = input.caption.trim();
  if (caption.length > CAPTION_MAX) {
    throw new LandmarkValidationError(`Caption must be at most ${CAPTION_MAX} characters.`);
  }

  let photoBytes: Uint8Array | null = null;
  if (input.photo) {
    if (input.photo.size === 0) throw new LandmarkValidationError("The photo is empty.");
    if (input.photo.size > PHOTO_MAX_BYTES) throw new LandmarkValidationError("The photo is too large.");
    photoBytes = new Uint8Array(await input.photo.arrayBuffer());
    if (!isJpeg(photoBytes)) throw new LandmarkValidationError("The photo must be a JPEG image.");
  }

  const user = await requireUser();
  const supabase = await createClient();

  const [landmark, existing] = await Promise.all([
    supabase.from("landmarks").select("id, hidden").eq("id", landmarkId).maybeSingle(),
    supabase.from("landmark_unlocks").select("user_id")
      .eq("landmark_id", landmarkId).eq("user_id", user.id).maybeSingle(),
  ]);
  if (landmark.error) throw new Error(`Failed to load landmark: ${landmark.error.message}`);
  if (existing.error) throw new Error(`Failed to load your unlock: ${existing.error.message}`);
  // A hidden landmark takes no new unlocks (the database enforces this too); existing ones can still be edited.
  if (!landmark.data || (landmark.data.hidden && !existing.data)) throw new LandmarkNotFoundError();

  // The unlock row comes first: Storage only accepts photos for landmarks you've unlocked.
  if (!existing.data) {
    if (!photoBytes) throw new LandmarkValidationError("Add a photo to unlock this landmark.");
    const { error } = await supabase.from("landmark_unlocks")
      .insert({ user_id: user.id, landmark_id: landmarkId, caption });
    if (error) {
      if (error.code === "42501") throw new AuthRequiredError("You are not allowed to unlock this landmark.");
      throw new Error(`Failed to unlock landmark: ${error.message}`);
    }
  } else {
    // Always written, even if unchanged, so updated_at marks the edit (and a new photo).
    const { error } = await supabase.from("landmark_unlocks")
      .update({ caption }).eq("landmark_id", landmarkId).eq("user_id", user.id);
    if (error) throw new Error(`Failed to update your unlock: ${error.message}`);
  }

  if (photoBytes) {
    const { error } = await supabase.storage.from(BUCKET).upload(`${user.id}/${landmarkId}.jpg`, photoBytes, {
      contentType: "image/jpeg",
      upsert: true,
      cacheControl: "60", // replaced photos should show up quickly
    });
    if (error) {
      console.error("Landmark photo upload failed", error);
      throw new LandmarkPhotoUploadError(existing.data
        ? "Your caption was saved, but the new photo didn't upload. Try again."
        : "Landmark unlocked, but the photo didn't upload. Add it again below.");
    }
  }
}
