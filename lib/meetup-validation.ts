import { z } from "zod";
import { COURSE_CODE_PATTERN } from "@/lib/course-codes";
import { CAMPUS_LOCATIONS, type CampusLocation } from "@/lib/locations";
import { CUSTOM_LOCATION_ERROR, isCustomLocationText } from "@/lib/meetup-location";
import { getPublicVenue } from "@/lib/public-venues";
import type { CreateMeetupInput, MeetupCategory } from "@/types/meetup";

// Pure validation shared by the server (lib/meetups.ts) and, optionally, client forms.
// The database re-enforces the same rules (see supabase/migrations), so client-side
// use is only for friendlier error messages.

export const MEETUP_CATEGORIES = [
  "coffee", "study", "food", "sports", "gaming", "other",
] as const satisfies readonly MeetupCategory[];

export const TITLE_MIN = 3;
export const TITLE_MAX = 80;
export const DESCRIPTION_MAX = 500;

// Coordinates from the client are compared to the approved entry with a small tolerance,
// then replaced by the canonical values so the database never stores client-chosen points.
const COORDINATE_TOLERANCE = 1e-6;

export type MeetupFieldErrors = Partial<Record<keyof CreateMeetupInput | "form", string>>;

export type MeetupValidationResult =
  | { ok: true; value: CreateMeetupInput }
  | { ok: false; errors: MeetupFieldErrors };

export function findApprovedLocation(
  name: string,
  latitude: number,
  longitude: number,
): CampusLocation | undefined {
  return CAMPUS_LOCATIONS.find((place) => matchesLocation(place, name, latitude, longitude));
}

function matchesLocation(place: CampusLocation, name: string, latitude: number, longitude: number): boolean {
  return place.name === name &&
    Math.abs(place.latitude - latitude) <= COORDINATE_TOLERANCE &&
    Math.abs(place.longitude - longitude) <= COORDINATE_TOLERANCE;
}

const createMeetupSchema = z.object({
  title: z.string().trim()
    .min(TITLE_MIN, `Title must be at least ${TITLE_MIN} characters.`)
    .max(TITLE_MAX, `Title must be at most ${TITLE_MAX} characters.`),
  description: z.string().trim()
    .max(DESCRIPTION_MAX, `Description must be at most ${DESCRIPTION_MAX} characters.`)
    .default(""),
  category: z.enum(MEETUP_CATEGORIES, "Choose a valid category."),
  location_name: z.string("Choose a meetup location.").trim().min(1, "Choose a meetup location."),
  latitude: z.number("Choose a meetup location.").nullable(),
  longitude: z.number("Choose a meetup location.").nullable(),
  location_type: z.enum(["catalog", "custom"]).optional(),
  public_venue_id: z.string().min(1).optional(),
  starts_at: z.string("Choose a start time.").min(1, "Choose a start time."),
  course_code: z.string().regex(COURSE_CODE_PATTERN, "Choose a course from the list.").nullish(),
});

export function validateCreateMeetupInput(
  input: unknown,
  now: Date = new Date(),
): MeetupValidationResult {
  const parsed = createMeetupSchema.safeParse(input);
  const errors: MeetupFieldErrors = {};

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      const field = (issue.path[0] ?? "form") as keyof MeetupFieldErrors;
      errors[field] ??= issue.message;
    }
    return { ok: false, errors };
  }

  const data = parsed.data;
  const venue = data.public_venue_id === undefined ? undefined : getPublicVenue(data.public_venue_id);
  const custom = data.location_type === "custom";
  let location: CampusLocation | undefined;
  if (custom) {
    if (!isCustomLocationText(data.location_name)) errors.location_name = CUSTOM_LOCATION_ERROR;
    if (data.latitude !== null || data.longitude !== null || data.public_venue_id !== undefined) {
      errors.form = "Custom meeting spots must use text only.";
    }
  } else {
    const { location_name: name, latitude, longitude } = data;
    if (latitude !== null && longitude !== null) {
      location = data.public_venue_id === undefined
        ? findApprovedLocation(name, latitude, longitude)
        : venue && matchesLocation(venue, name, latitude, longitude) ? venue : undefined;
    }
    if (!location) errors.location_name = "Choose an approved campus location or public venue.";
  }

  const startsAt = new Date(data.starts_at);
  if (Number.isNaN(startsAt.getTime())) {
    errors.starts_at = "Start time is not a valid date.";
  } else if (startsAt.getTime() <= now.getTime()) {
    errors.starts_at = "Start time must be in the future.";
  }

  // The database also enforces this (meetups_course_only_for_study) and that the course exists.
  if (data.course_code && data.category !== "study") errors.course_code = "Only study meetups can have a course.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    value: {
      ...(custom ? { location_type: "custom" as const } : {}),
      ...(venue ? { public_venue_id: venue.id } : {}),
      title: data.title,
      description: data.description,
      category: data.category,
      location_name: location?.name ?? data.location_name,
      latitude: location?.latitude ?? null,
      longitude: location?.longitude ?? null,
      starts_at: startsAt.toISOString(),
      course_code: data.course_code ?? null,
    },
  };
}
