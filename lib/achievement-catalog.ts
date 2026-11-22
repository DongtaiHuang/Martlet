// The list of achievements (ADR 0019). Client-safe: no server imports.
// Hidden achievements show as "???" until earned. Adding one is a code change only;
// ids must match the shape checked in supabase/migrations/010_achievements.sql.

export const ACHIEVEMENTS = [
  { id: "bird-whisperer", icon: "🐦", title: "Bird whisperer", description: "Hovered over a martlet until it spoke.", hidden: true },
  { id: "chatterbox", icon: "🗣️", title: "Chatterbox", description: "Heard 10 different martlet quotes.", hidden: true },
  { id: "fruit-inspector", icon: "🍎", title: "Fruit inspector", description: "Checked out a photo hanging on your tree.", hidden: true },
  { id: "time-traveller", icon: "⏳", title: "Time traveller", description: "Previewed your tree at another growth stage.", hidden: true },
  { id: "new-angle", icon: "🧭", title: "New angle", description: "Tilted or rotated the campus map.", hidden: true },
  { id: "night-owl", icon: "🦉", title: "Night owl", description: "Opened Martlet between 2 and 5 a.m. Go to sleep.", hidden: true },
  { id: "old-school", icon: "🎮", title: "Old school", description: "Entered ↑ ↑ ↓ ↓ ← → ← → B A.", hidden: true },
  { id: "field-trip", icon: "🚌", title: "Field trip", description: "Visit an off-campus landmark on the map.", hidden: false },
  { id: "tourist", icon: "🗺️", title: "Tourist", description: "Explore every landmark on the map.", hidden: false },
  // Activity ladders (ADR 0020): earned server-side from real activity counts
  // (see lib/activity-achievements.ts), not from browser triggers.
  { id: "nest-builder", icon: "🪺", title: "Nest builder", description: "Host your first meetup.", hidden: false },
  { id: "flock-leader", icon: "🎤", title: "Flock leader", description: "Host 5 meetups.", hidden: false },
  { id: "first-flight", icon: "🐣", title: "First flight", description: "Peck (join) your first meetup.", hidden: false },
  { id: "flock-regular", icon: "🤝", title: "Flock regular", description: "Peck 10 meetups.", hidden: false },
  { id: "cheerful-martlet", icon: "👏", title: "Cheerful martlet", description: "Flap your first meetup.", hidden: false },
  { id: "standing-ovation", icon: "🎉", title: "Standing ovation", description: "Flap 25 meetups.", hidden: false },
  { id: "campus-explorer", icon: "📍", title: "Campus explorer", description: "Unlock 3 landmarks.", hidden: false },
  { id: "full-bloom", icon: "🌸", title: "Full bloom", description: "Unlock every landmark.", hidden: false },
  { id: "trendsetter", icon: "🔥", title: "Trendsetter", description: "Share your first trend.", hidden: false },
  { id: "campus-taste", icon: "🏆", title: "Campus taste", description: "Collect 10 likes on trends you shared.", hidden: false },
] as const;

export type Achievement = (typeof ACHIEVEMENTS)[number];
export type AchievementId = Achievement["id"];

const BY_ID = new Map<string, Achievement>(ACHIEVEMENTS.map((a) => [a.id, a]));

export function isAchievementId(value: unknown): value is AchievementId {
  return typeof value === "string" && BY_ID.has(value);
}

export function getAchievement(id: AchievementId): Achievement {
  return BY_ID.get(id)!;
}

/** Result of trying to earn an achievement. "guest" = not saved to an account (signed out or demo mode). */
export type EarnResult = "new" | "already" | "guest" | "invalid" | "error";

/** Earned achievement ids mapped to when they were earned (ISO date). */
export type EarnedMap = Partial<Record<AchievementId, string>>;
