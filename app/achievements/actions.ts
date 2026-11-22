"use server";

import { EXPO_67_ID, isAchievementId, type EarnedMap, type EarnResult } from "@/lib/achievement-catalog";
import { AchievementsNotSetUpError, listMyAchievements, recordAchievement } from "@/lib/achievements";

/** Called from the browser for cosmetic interaction triggers. */
export async function earnAchievement(id: unknown): Promise<EarnResult> {
  if (!isAchievementId(id) || id === EXPO_67_ID) return "invalid";
  try {
    return await recordAchievement(id);
  } catch (error) {
    console.error("Saving an achievement failed", error);
    return "error";
  }
}

/** The signed-in user's achievements (null for guests), for the Profile menu. Throws on failure. */
export async function myAchievements(): Promise<EarnedMap | null> {
  try {
    return await listMyAchievements();
  } catch (error) {
    if (error instanceof AchievementsNotSetUpError) return null; // browser copy instead
    throw error;
  }
}
