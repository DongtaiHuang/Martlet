"use server";

import { revalidatePath } from "next/cache";
import { EXPO_67_ID, type AchievementId } from "@/lib/achievement-catalog";
import { recordAchievement } from "@/lib/achievements";
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
  achievement?: AchievementId;
  achievementWarning?: string;
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
  if (hadPhoto && landmarkId === EXPO_67_ID) {
    const success = "Saved! Your photo is up.";
    try {
      const result = await recordAchievement(EXPO_67_ID);
      if (result === "new") return { success, achievement: EXPO_67_ID };
      if (result === "already") return { success };
    } catch (error) {
      console.error("Failed to save the 67 achievement", error);
    }
    return { success, achievementWarning: "The 67 achievement couldn’t be saved. Upload your photo again to retry." };
  }
  return { success: hadPhoto ? "Saved! Your photo is up." : "Caption saved." };
}

function revalidateLandmark(landmarkId: string) {
  revalidatePath(`/landmarks/${landmarkId}`);
  revalidatePath("/landmarks");
  revalidatePath("/explore");
}
