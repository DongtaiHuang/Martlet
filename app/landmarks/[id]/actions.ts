"use server";

import { revalidatePath } from "next/cache";
import {
  AuthRequiredError,
  LandmarkNotFoundError,
  LandmarkPhotoUploadError,
  LandmarkValidationError,
  MockModeError,
  saveUnlock,
} from "@/lib/landmarks";

export interface UnlockState {
  error?: string;
  success?: string;
}

const EXPECTED_ERRORS = [
  AuthRequiredError, LandmarkNotFoundError, LandmarkPhotoUploadError, LandmarkValidationError, MockModeError,
];

/** Bound to a landmark id by the page: `saveUnlockAction.bind(null, landmark.id)`. */
export async function saveUnlockAction(
  landmarkId: string,
  _previous: UnlockState,
  formData: FormData,
): Promise<UnlockState> {
  const photo = formData.get("photo");
  const caption = formData.get("caption");
  const hadPhoto = photo instanceof Blob && photo.size > 0;

  try {
    await saveUnlock(landmarkId, {
      photo: hadPhoto ? photo : null,
      caption: typeof caption === "string" ? caption : "",
    });
  } catch (error) {
    if (error instanceof LandmarkPhotoUploadError) revalidateLandmark(landmarkId); // the row did save
    if (EXPECTED_ERRORS.some((type) => error instanceof type)) return { error: (error as Error).message };
    console.error("Failed to save landmark unlock", error);
    return { error: "Something went wrong. Try again." };
  }

  revalidateLandmark(landmarkId);
  return { success: hadPhoto ? "Saved! Your photo is up." : "Caption saved." };
}

function revalidateLandmark(landmarkId: string) {
  revalidatePath(`/landmarks/${landmarkId}`);
  revalidatePath("/landmarks");
  revalidatePath("/explore");
}
