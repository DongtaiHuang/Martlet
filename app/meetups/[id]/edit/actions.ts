"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { parseMeetupForm, type MeetupFormState } from "@/lib/meetup-form";
import { MeetupLockedError, MeetupNotFoundError, MeetupValidationError, updateMeetup } from "@/lib/meetups";
import { AuthRequiredError } from "@/lib/supabase/auth";

/** Save edits to a meetup the signed-in user hosts (issue #73). Bound to the meetup id by the page. */
export async function submitMeetupEdit(id: string, _previous: MeetupFormState, formData: FormData): Promise<MeetupFormState> {
  const parsed = parseMeetupForm(formData);
  if (!parsed.ok) return parsed.state;

  try {
    if (!(await getMeetupViewer())) return { message: "Sign in to edit your meetup." };
    await updateMeetup(id, parsed.input);
  } catch (error) {
    if (error instanceof MeetupValidationError) {
      const { course_code, starts_at, location_name, form } = error.fieldErrors;
      if (course_code) return { message: "Check the highlighted fields.", fields: { course_code: [course_code] } };
      if (starts_at) return { message: "Check the highlighted fields.", fields: { startsAt: [starts_at] } };
      if (location_name) return { message: location_name };
      return { message: form ?? "The meetup did not pass validation." };
    }
    if (error instanceof MeetupLockedError || error instanceof MeetupNotFoundError || error instanceof AuthRequiredError) {
      return { message: error.message };
    }
    console.error("Meetup update failed", error);
    return { message: "Couldn’t save your changes. Try again in a moment." };
  }

  revalidatePath(`/meetups/${encodeURIComponent(id)}`);
  revalidatePath("/meetups");
  revalidatePath("/explore");
  redirect(`/meetups/${encodeURIComponent(id)}?updated=1`);
}
