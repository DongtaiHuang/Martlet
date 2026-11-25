import { z } from "zod";

export const MEETUP_CATEGORIES = ["coffee", "study", "food", "sports", "gaming", "skills", "other"] as const;
export type MeetupCategory = typeof MEETUP_CATEGORIES[number];
export const MAX_MEETUP_CATEGORIES = 3;

export const meetupCategoriesSchema = z.array(z.enum(MEETUP_CATEGORIES, "Choose a valid category."))
  .min(1, "Choose at least one category.")
  .max(MAX_MEETUP_CATEGORIES, "Choose up to three categories.")
  .refine((values) => new Set(values).size === values.length, "Choose each category only once.")
  .refine((values) => values.length === 1 || !values.includes("other"), "Choose Other on its own.");

export function filterMeetupsByCategory<T extends { categories: readonly MeetupCategory[] }>(
  meetups: T[], category: MeetupCategory | "all",
): T[] {
  return category === "all" ? meetups : meetups.filter((meetup) => meetup.categories.includes(category));
}
