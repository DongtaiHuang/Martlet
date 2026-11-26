// Meetup photo albums (ADR 0039). Components call these, not Supabase directly.
// Writes go through migration 025's RPCs, which take the user from the session.
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "meetup-photos";
const URL_SECONDS = 3600;

export class AlbumError extends Error {}

export type AlbumPhoto = {
  id: string;
  url: string;
  downloadUrl: string;
  uploaderName: string;
  mine: boolean;
  /** The uploader or the meetup's host can remove it. */
  canRemove: boolean;
};

export type Album = { photos: AlbumPhoto[]; myCount: number };

type Row = { id: string; uploader_id: string; author: { display_name: string } | { display_name: string }[] | null };

const pathOf = (meetupId: string, photoId: string) => `${meetupId}/${photoId}.jpg`;

async function session() {
  if (getDataMode() !== "live") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return userId ? { supabase, userId } : null;
}

/** The album for a meetup, or null when the viewer isn't the host or going (or isn't signed in). */
export async function getMeetupAlbum(meetup: { id: string; host_id: string }): Promise<Album | null> {
  const s = await session();
  if (!s) return null;
  const { data: participant, error: participantError } = await s.supabase.rpc("is_meetup_participant", { p_meetup: meetup.id });
  if (participantError) throw new Error("Could not check album access", { cause: participantError });
  if (!participant) return null;

  // RLS returns only live, visible photos (moderators also see hidden ones).
  const { data, error } = await s.supabase
    .from("meetup_photos")
    .select("id, uploader_id, author:profiles!uploader_id(display_name)")
    .eq("meetup_id", meetup.id)
    .eq("status", "visible")
    .order("created_at", { ascending: true })
    .returns<Row[]>();
  if (error) throw new Error("Could not load the album", { cause: error });
  if (data.length === 0) return { photos: [], myCount: 0 };

  const paths = data.map((row) => pathOf(meetup.id, row.id));
  const bucket = s.supabase.storage.from(BUCKET);
  const [view, download] = await Promise.all([
    bucket.createSignedUrls(paths, URL_SECONDS),
    bucket.createSignedUrls(paths, URL_SECONDS, { download: true }),
  ]);
  const urls = new Map((view.data ?? []).filter((u) => u.signedUrl && !u.error).map((u) => [u.path, u.signedUrl as string]));
  const downloads = new Map((download.data ?? []).filter((u) => u.signedUrl && !u.error).map((u) => [u.path, u.signedUrl as string]));

  const isHost = meetup.host_id === s.userId;
  const photos: AlbumPhoto[] = [];
  for (const row of data) {
    const path = pathOf(meetup.id, row.id);
    const url = urls.get(path);
    if (!url) continue; // reserved but never uploaded, or not readable any more
    const author = Array.isArray(row.author) ? row.author[0] : row.author;
    photos.push({
      id: row.id, url, downloadUrl: downloads.get(path) ?? url,
      uploaderName: author?.display_name ?? "A student",
      mine: row.uploader_id === s.userId,
      canRemove: row.uploader_id === s.userId || isHost,
    });
  }
  return { photos, myCount: data.filter((row) => row.uploader_id === s.userId).length };
}

/** Adds one JPEG (already resized and stripped of EXIF in the browser) to the album. */
export async function addMeetupPhoto(meetupId: string, image: Uint8Array): Promise<void> {
  await requireUser();
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("add_meetup_photo", { p_meetup: meetupId });
  if (error) {
    if (error.hint === "album-closed") throw new AlbumError("This album is closed.");
    if (error.hint === "photo-limit") throw new AlbumError("You've reached the photo limit for this meetup.");
    if (error.hint === "album-full") throw new AlbumError("This album is full.");
    if (error.code === "42501") throw new AlbumError("Only the host and people going can add photos.");
    throw new Error(error.message);
  }
  const upload = await supabase.storage.from(BUCKET).upload(pathOf(meetupId, id as string), image, { contentType: "image/jpeg" });
  if (upload.error) {
    console.error("Meetup photo upload failed", upload.error);
    await supabase.rpc("remove_meetup_photo", { p_photo: id });
    throw new AlbumError("The photo didn't upload. Try again.");
  }
}

export async function removeMeetupPhoto(photoId: string): Promise<void> {
  await requireUser();
  const { error } = await (await createClient()).rpc("remove_meetup_photo", { p_photo: photoId });
  if (error) throw new Error(error.message);
}

/**
 * Deletes the signed-in student's photo files that nobody can see any more (removed, album
 * closed, meetup deleted), then forgets their rows. Runs in the background a few times a day.
 */
export async function purgeMyDeadMeetupPhotos(): Promise<number> {
  const s = await session();
  if (!s) return 0;
  const { data: names, error } = await s.supabase.rpc("my_meetup_photo_files_to_purge");
  if (error) throw new Error(error.message);
  const list = (names ?? []) as string[];
  if (list.length > 0) {
    const removed = await s.supabase.storage.from(BUCKET).remove(list);
    if (removed.error) throw new Error(removed.error.message);
  }
  await s.supabase.rpc("forget_my_purged_meetup_photos");
  return list.length;
}
