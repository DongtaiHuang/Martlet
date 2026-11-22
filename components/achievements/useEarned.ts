"use client";
import { useMemo, useSyncExternalStore } from "react";
import { isAchievementId, type EarnedMap } from "@/lib/achievement-catalog";
import { guestSnapshot, sessionSnapshot, subscribeEarned } from "./earn";

function parse(raw: string): EarnedMap {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([id, at]) => isAchievementId(id) && typeof at === "string"));
  } catch {
    return {};
  }
}

/**
 * Earned achievements, kept live. `account` is the signed-in user's list from the server;
 * null means a guest (signed out or demo mode), so this browser's list is used instead;
 * undefined means not loaded yet (only this page session's new ones are shown).
 */
export function useEarned(account: EarnedMap | null | undefined): EarnedMap {
  const guest = account === null;
  const raw = useSyncExternalStore(subscribeEarned, guest ? guestSnapshot : sessionSnapshot, () => "{}");
  return useMemo(() => ({ ...parse(raw), ...account }), [raw, account]);
}
