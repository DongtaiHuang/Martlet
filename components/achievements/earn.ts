// Browser-side achievement triggers (ADR 0019). Call earn(id) when something happens;
// it saves to the account (server action, user from the session) or, for guests, to this
// browser, then announces it so <AchievementToaster> can show the bar.
import { earnAchievement } from "@/app/achievements/actions";
import { isAchievementId, type AchievementId, type EarnedMap } from "@/lib/achievement-catalog";

export const ACHIEVEMENT_EVENT = "martlet:achievement";
const GUEST_KEY = "martlet:achievements";

/** Per-viewer storage; can be unavailable (private mode, blocked site data), so every access is guarded. */
export function readStore<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function writeStore(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* not saved; fine */ }
}

/** Raw guest store, as a string so React can compare snapshots cheaply. */
export function guestSnapshot(): string {
  try { return localStorage.getItem(GUEST_KEY) ?? "{}"; } catch { return "{}"; }
}

// Achievements earned during this page session (so the achievements page updates live).
let sessionEarned: EarnedMap = {};
let sessionSnap = "{}";
export const sessionSnapshot = () => sessionSnap;

export function subscribeEarned(callback: () => void) {
  window.addEventListener(ACHIEVEMENT_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(ACHIEVEMENT_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}

const pending = new Set<AchievementId>();
const done = new Set<AchievementId>();

export async function earn(id: AchievementId) {
  if (!isAchievementId(id) || done.has(id) || pending.has(id)) return;
  pending.add(id);
  let result: Awaited<ReturnType<typeof earnAchievement>>;
  try {
    result = await earnAchievement(id);
  } catch {
    result = "error";
  } finally {
    pending.delete(id);
  }
  if (result === "error") return; // try again next time it's triggered
  done.add(id);
  if (result === "already" || result === "invalid") return;

  const now = new Date().toISOString();
  if (result === "guest") {
    const guest = readStore<EarnedMap>(GUEST_KEY, {});
    if (guest[id]) return;
    guest[id] = now;
    writeStore(GUEST_KEY, guest);
  }
  sessionEarned = { ...sessionEarned, [id]: now };
  sessionSnap = JSON.stringify(sessionEarned);
  window.dispatchEvent(new CustomEvent(ACHIEVEMENT_EVENT, { detail: { id, saved: result === "new" } }));
}

/** Counts distinct quotes heard on this device; 10 earns Chatterbox. */
export function heardQuote(quote: string) {
  const heard = new Set(readStore<string[]>("martlet:quotes-heard", []));
  if (heard.has(quote)) return;
  heard.add(quote);
  writeStore("martlet:quotes-heard", [...heard]);
  if (heard.size >= 10) void earn("chatterbox");
}
