// The look a student picked in the avatar studio (plumage + worn accessories), saved in this
// browser so other places, like Martlet Flight (#132), can draw the same martlet. Cosmetic and
// local only: nothing is sent to the server. Unlocks are checked when the studio saves.
import { ITEMS, PLUMAGES, type ItemId, type Plumage, type PlumageId } from "./items.ts";

export interface AvatarLook { plumage: PlumageId; wearing: ItemId[] }

export const LOOK_KEY = "martlet.avatar.look";
export const DEFAULT_LOOK: AvatarLook = { plumage: "marty", wearing: [] };

/** Validates untrusted stored data: known ids only, no duplicates, at most one hat. */
export function parseLook(raw: string | null): AvatarLook | null {
  if (!raw) return null;
  let value: unknown;
  try { value = JSON.parse(raw); } catch { return null; }
  if (!value || typeof value !== "object") return null;
  const { plumage, wearing } = value as { plumage?: unknown; wearing?: unknown };
  if (!PLUMAGES.some((p) => p.id === plumage) || !Array.isArray(wearing)) return null;
  const items: ItemId[] = [];
  let hat = false;
  for (const id of wearing) {
    const item = ITEMS.find((i) => i.id === id);
    if (!item || items.includes(item.id)) continue;
    if (item.slot === "hat") { if (hat) continue; hat = true; }
    items.push(item.id);
  }
  return { plumage: plumage as PlumageId, wearing: items };
}

export function readLook(): AvatarLook | null {
  try { return parseLook(localStorage.getItem(LOOK_KEY)); } catch { return null; }
}

export function saveLook(look: AvatarLook) {
  try { localStorage.setItem(LOOK_KEY, JSON.stringify(look)); } catch { /* storage full or disabled: the look just isn't kept */ }
}

export function plumageOf(look: AvatarLook): Plumage {
  return PLUMAGES.find((p) => p.id === look.plumage) ?? PLUMAGES[0];
}
