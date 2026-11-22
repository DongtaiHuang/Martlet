"use client";
import { useEffect } from "react";
import type { AchievementId } from "@/lib/achievement-catalog";
import { earn } from "./earn";

/** Earns an achievement when rendered (for server-rendered pages, e.g. a tree stage preview). */
export function EarnOnMount({ id }: { id: AchievementId }) {
  useEffect(() => { void earn(id); }, [id]);
  return null;
}
