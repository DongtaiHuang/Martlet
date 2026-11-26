"use server";

import { revalidatePath } from "next/cache";
import { AlbumError, addMeetupPhoto, purgeMyDeadMeetupPhotos, removeMeetupPhoto } from "@/lib/meetup-photos";
import { AuthRequiredError } from "@/lib/supabase/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_IMAGE = 3_000_000;

/** Adds one photo; returns an error message or null. */
export async function uploadPhotoAction(meetupId: string, form: FormData): Promise<string | null> {
  if (!UUID.test(meetupId)) return "That meetup isn't available.";
  const file = form.get("photo");
  if (!(file instanceof Blob) || file.size === 0) return "Choose a photo.";
  if (file.size > MAX_IMAGE) return "That photo is too large.";
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!(bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff)) return "The photo must be a JPEG.";
  try {
    await addMeetupPhoto(meetupId, bytes);
  } catch (error) {
    if (error instanceof AlbumError) return error.message;
    if (error instanceof AuthRequiredError) return "Sign in to add photos.";
    console.error("Album upload failed", error);
    return "Something went wrong. Try again.";
  }
  revalidatePath(`/meetups/${meetupId}`);
  return null;
}

export async function removePhotoAction(meetupId: string, photoId: string): Promise<void> {
  if (!UUID.test(meetupId) || !UUID.test(photoId)) return;
  await removeMeetupPhoto(photoId).catch((error) => console.error("Album remove failed", error));
  revalidatePath(`/meetups/${meetupId}`);
}

/** Background clean-up of the student's own expired photo files (ADR 0039). */
export async function purgePhotosAction(): Promise<void> {
  await purgeMyDeadMeetupPhotos().catch((error) => console.error("Photo purge failed", error));
}
