// Meetup photo album rules shared by server and browser (ADR 0039).
// Mirrors supabase/migrations/025_meetup_photos.sql: keep the numbers in sync.

export const ALBUM_DAYS = 7;
export const PHOTOS_PER_PERSON = 20;
export const PHOTOS_PER_MEETUP = 300;

const DAY = 86_400_000;

export type AlbumState = "not-started" | "open" | "closed";

/** When the album closes and its photos stop being available (ms since epoch). */
export function albumClosesAt(startsAt: string): number {
  return Date.parse(startsAt) + ALBUM_DAYS * DAY;
}

export function albumState(meetup: { starts_at: string; status: string }, now: number): AlbumState {
  if (meetup.status !== "open") return "closed";
  if (now < Date.parse(meetup.starts_at)) return "not-started";
  return now < albumClosesAt(meetup.starts_at) ? "open" : "closed";
}

/** "in 3 days", "in 5 hours", "in 20 minutes" until the album closes. */
export function timeLeft(closesAt: number, now: number): string {
  const ms = Math.max(0, closesAt - now);
  const plural = (n: number, unit: string) => `in ${n} ${unit}${n === 1 ? "" : "s"}`;
  if (ms >= 2 * DAY) return plural(Math.floor(ms / DAY), "day");
  if (ms >= 2 * 3_600_000) return plural(Math.floor(ms / 3_600_000), "hour");
  return plural(Math.max(1, Math.ceil(ms / 60_000)), "minute");
}
