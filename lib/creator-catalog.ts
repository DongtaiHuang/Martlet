// Creator directory catalog shared by server and browser (ADR 0042).
// Mirrors the checks in supabase/migrations/029_creator_directory.sql: keep them in sync.

export const DISCIPLINES = ["music", "coding", "photography", "art", "design", "video", "writing", "tutoring", "other"] as const;
export type Discipline = (typeof DISCIPLINES)[number];

export const DISCIPLINE_INFO: Record<Discipline, { label: string; emoji: string; example: string }> = {
  music: { label: "Music", emoji: "🎵", example: "Beats, mixing, session guitar, lessons" },
  coding: { label: "Coding", emoji: "💻", example: "Websites, apps, scripts, debugging help" },
  photography: { label: "Photography", emoji: "📷", example: "Portraits, events, headshots" },
  art: { label: "Drawing & art", emoji: "🎨", example: "Illustration, portraits, commissions" },
  design: { label: "Design", emoji: "✏️", example: "Logos, posters, club branding" },
  video: { label: "Video", emoji: "🎬", example: "Editing, recaps, short films" },
  writing: { label: "Writing", emoji: "📝", example: "Editing, proofreading, translation" },
  tutoring: { label: "Tutoring", emoji: "📚", example: "Course help, language practice" },
  other: { label: "Other", emoji: "✨", example: "Anything else you’re good at" },
};

export const MAX_DISCIPLINES = 3;
export const MAX_LINKS = 5;
export const MAX_WORKS = 8;
export const MAX_BUDGET_CENTS = 100_000;

export const REQUEST_STATUSES = ["open", "accepted", "declined", "closed"] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];
export const REQUEST_STATUS_LABELS: Record<RequestStatus, string> = { open: "Waiting for reply", accepted: "Accepted", declined: "Declined", closed: "Closed" };

const LINK = /^https:\/\/[^\s<>"]{3,290}$/;

/** True for the https links the database accepts. */
export const isCreatorLink = (value: string) => LINK.test(value);

/** One link per line (blank lines ignored). Returns null if any line isn't an accepted https link or there are too many. */
export function parseLinks(text: string): string[] | null {
  const links = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (links.length > MAX_LINKS || !links.every(isCreatorLink)) return null;
  return [...new Set(links)];
}

/** A short label for a link: the host without "www.", e.g. "soundcloud.com". */
export function linkLabel(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/** "$80", "$12.50" or "Open budget". */
export function formatBudget(cents: number | null): string {
  if (cents === null) return "Open budget";
  return `$${(cents / 100).toLocaleString("en-CA", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
}
