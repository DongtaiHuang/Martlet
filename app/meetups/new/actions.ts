"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { categoryValues } from "@/components/feed/categories";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { getCampusLocation } from "@/lib/locations";
import { createMeetup } from "@/lib/meetups";

const meetupInput = z.object({
  title: z.string().trim().min(3, "Enter at least 3 characters.").max(80, "Use 80 characters or fewer."),
  description: z.string().trim().max(500, "Use 500 characters or fewer."),
  category: z.enum(categoryValues, { error: "Choose a category." }),
  location: z.string().transform((id, context) => {
    const place = getCampusLocation(id);
    if (place) return place;
    context.addIssue({ code: "custom", message: "Choose an approved campus location." });
    return z.NEVER;
  }),
  startsAt: z.iso.datetime({ error: "Enter a valid date and time." })
    .refine((value) => Date.parse(value) > Date.now(), "Choose a start time in the future."),
});

export type CreateState = {
  message?: string;
  fields?: Partial<Record<keyof z.input<typeof meetupInput>, string[]>>;
};

export async function submitMeetup(_previous: CreateState, formData: FormData): Promise<CreateState> {
  const input = meetupInput.safeParse({
    title: formData.get("title") ?? "",
    description: formData.get("description") ?? "",
    category: formData.get("category"),
    location: formData.get("location") ?? "",
    startsAt: formData.get("startsAt"),
  });

  if (!input.success) {
    return { message: "Check the highlighted fields.", fields: z.flattenError(input.error).fieldErrors };
  }

  const { title, description, category, location, startsAt } = input.data;
  let id: string;
  try {
    if (!(await getMeetupViewer())) {
      return { message: "Sign in with a student account to create a meetup." };
    }

    const meetup = await createMeetup({
      title,
      description,
      category,
      location_name: location.name,
      latitude: location.latitude,
      longitude: location.longitude,
      starts_at: startsAt,
    });
    id = meetup.id;
  } catch (error) {
    console.error("Meetup creation failed", error);
    return { message: "Couldn’t create the meetup. Try again when the meetup service is available." };
  }

  revalidatePath("/meetups");
  revalidatePath("/explore");
  redirect(`/meetups/${encodeURIComponent(id)}`);
}
