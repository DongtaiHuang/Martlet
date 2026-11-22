// Martlet avatar unlocks (prototype). Derived from activity counts only; no new tables.

export interface Progress { hosted: number; joined: number; landmarks: number }
export const total = (p: Progress) => p.hosted + p.joined + p.landmarks;

export type ItemId = "scarf" | "backpack" | "camera" | "beanie" | "gradcap";
export type Slot = "neck" | "back" | "chest" | "hat";
export interface Item { id: ItemId; label: string; slot: Slot; requirement: string; unlocked: (p: Progress) => boolean }

export const ITEMS: Item[] = [
  { id: "scarf", label: "McGill scarf", slot: "neck", requirement: "Join 3 meetups", unlocked: (p) => p.joined >= 3 },
  { id: "backpack", label: "Backpack", slot: "back", requirement: "Host a meetup", unlocked: (p) => p.hosted >= 1 },
  { id: "camera", label: "Camera", slot: "chest", requirement: "Unlock a landmark", unlocked: (p) => p.landmarks >= 1 },
  { id: "beanie", label: "Winter beanie", slot: "hat", requirement: "10 achievements", unlocked: (p) => total(p) >= 10 },
  { id: "gradcap", label: "Graduation cap", slot: "hat", requirement: "20 achievements", unlocked: (p) => total(p) >= 20 },
];

export type PlumageId = "classic" | "teal" | "crimson" | "gold";
export interface Plumage { id: PlumageId; label: string; body: string; wing: string; requirement: string; unlocked: (p: Progress) => boolean }

export const PLUMAGES: Plumage[] = [
  { id: "classic", label: "Classic", body: "#1f2a44", wing: "#151d33", requirement: "Default", unlocked: () => true },
  { id: "teal", label: "Midnight teal", body: "#134e4a", wing: "#0d3a37", requirement: "Host 3 meetups", unlocked: (p) => p.hosted >= 3 },
  { id: "crimson", label: "Crimson", body: "#8b1e2d", wing: "#6b1522", requirement: "10 achievements", unlocked: (p) => total(p) >= 10 },
  { id: "gold", label: "Golden", body: "#9a6b12", wing: "#7a530b", requirement: "Unlock 3 landmarks", unlocked: (p) => p.landmarks >= 3 },
];

/** Landmark pins shown on the bird: one per landmark, up to 5. */
export const pinCount = (p: Progress) => Math.min(5, p.landmarks);
