// Shared parsing for the create and edit meetup forms (issue #73), so both validate the same way.
import { z } from "zod";
import { categoryValues } from "@/components/feed/categories";
import { CUSTOM_LOCATION_ERROR, isCustomLocationText } from "@/lib/meetup-location";
import { OTHER_LOCATION } from "@/lib/public-venues";
import { COURSE_CODE_PATTERN } from "@/lib/course-codes";
import { getCampusLocation } from "@/lib/locations";
import type { CreateMeetupInput } from "@/types/meetup";

export const meetupFormSchema = z.object({
  title: z.string().trim().min(3, "Enter at least 3 characters.").max(80, "Use 80 characters or fewer."),
  description: z.string().trim().max(500, "Use 500 characters or fewer."),
  category: z.enum(categoryValues, { error: "Choose a category." }),
  location: z.string().refine(
    (id) => id === OTHER_LOCATION || Boolean(getCampusLocation(id)),
    "Choose an approved campus location or select Other.",
  ),
  customLocation: z.string().trim(),
  startsAt: z.iso.datetime({ error: "Enter a valid date and time." })
    .refine((value) => Date.parse(value) > Date.now(), "Choose a start time in the future."),
  // Optional McGill course; checked below and by the database.
  course_code: z.string().regex(COURSE_CODE_PATTERN, "Choose a course from the list.").nullable(),
}).refine((input) => !input.course_code || input.category === "study", {
  path: ["course_code"],
  message: "Only study meetups can have a course.",
}).refine(({ location, customLocation }) => location !== OTHER_LOCATION || isCustomLocationText(customLocation), {
  path: ["customLocation"],
  message: CUSTOM_LOCATION_ERROR,
});

export type MeetupFormState = {
  message?: string;
  fields?: Partial<Record<keyof z.input<typeof meetupFormSchema>, string[]>>;
};

export type ParsedMeetupForm = { ok: true; input: CreateMeetupInput } | { ok: false; state: MeetupFormState };

export function parseMeetupForm(formData: FormData): ParsedMeetupForm {
  const parsed = meetupFormSchema.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    location: formData.get("location") ?? "",
    customLocation: formData.get("customLocation") ?? "",
    startsAt: formData.get("startsAt"),
    course_code: formData.get("course_code") || null,
  });
  if (!parsed.success) {
    return { ok: false, state: { message: "Check the highlighted fields.", fields: z.flattenError(parsed.error).fieldErrors } };
  }

  const { title, description, category, location, customLocation, startsAt, course_code } = parsed.data;
  const custom = location === OTHER_LOCATION;
  const place = getCampusLocation(location);
  if (!custom && !place) return { ok: false, state: { message: "Choose an approved campus location." } };
  return {
    ok: true,
    input: {
      title,
      description,
      category,
      ...(custom ? { location_type: "custom" as const } : {}),
      location_name: place?.name ?? customLocation,
      latitude: place?.latitude ?? null,
      longitude: place?.longitude ?? null,
      starts_at: startsAt,
      course_code,
    },
  };
}
