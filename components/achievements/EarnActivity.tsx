"use client";
import { useEffect } from "react";
import type { AchievementId } from "@/lib/achievement-catalog";
import { earn } from "./earn";

/**
 * Earns server-computed activity achievements when rendered (ADR 0020). Like
 * EarnOnMount, but for a list: the page decides which ladders are satisfied,
 * the shared earn() path decides whether they're new (and toasts).
 */
export function EarnActivity({ ids }: { ids: readonly AchievementId[] }) {
  const key = ids.join(",");
  useEffect(() => {
    if (!key) return;
    for (const id of key.split(",") as AchievementId[]) void earn(id);
  }, [key]);
  return null;
}
