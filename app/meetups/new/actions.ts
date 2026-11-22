"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { createMeetup, MeetupValidationError } from "@/lib/meetups";
import { parseMeetupForm, type MeetupFormState } from "@/lib/meetup-form";
import { notifyMeetupCreated } from "@/lib/notifications";

export type CreateState = MeetupFormState;

export async function submitMeetup(_previous: CreateState, formData: FormData): Promise<CreateState> {
  const parsed = parseMeetupForm(formData);
  if (!parsed.ok) return parsed.state;
  let id: string;
  try {
    if (!(await getMeetupViewer())) {
      return { message: "Sign in with a student account to create a meetup." };
    }

    const meetup = await createMeetup(parsed.input);
    id = meetup.id;
    // Notifications are best-effort: a failure never blocks creation (ADR 0021).
    try {
      await notifyMeetupCreated(id);
    } catch (error) {
      console.error("Failed to send meetup notifications", error);
    }
  } catch (error) {
    if (error instanceof MeetupValidationError && error.fieldErrors.course_code) {
      return { message: "Check the highlighted fields.", fields: { course_code: [error.fieldErrors.course_code] } };
    }
    console.error("Meetup creation failed", error);
    return { message: "Couldn’t create the meetup. Try again when the meetup service is available." };
  }

  revalidatePath("/meetups");
  revalidatePath("/explore");
  redirect(`/meetups/${encodeURIComponent(id)}`);
}
