"use server";

import { isAchievementId, type EarnResult } from "@/lib/achievement-catalog";
import { recordAchievement } from "@/lib/achievements";

/** Called from the browser when an achievement's trigger happens. Only catalogue ids are accepted. */
export async function earnAchievement(id: unknown): Promise<EarnResult> {
  if (!isAchievementId(id)) return "invalid";
  try {
    return await recordAchievement(id);
  } catch (error) {
    console.error("Saving an achievement failed", error);
    return "error";
  }
}
