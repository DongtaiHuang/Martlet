"use server";

import { revalidatePath } from "next/cache";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { cancelMeetup, getMeetup } from "@/lib/meetups";

type CancelState = { message?: string; success?: boolean };

export async function submitCancellation(
  id: string,
  _previous: CancelState,
  _formData: FormData,
): Promise<CancelState> {
  try {
    const viewer = await getMeetupViewer();
    if (!viewer) return { message: "Sign in to cancel a meetup you host." };

    const meetup = await getMeetup(id);
    if (!meetup) return { message: "This meetup is no longer available." };
    if (meetup.host_id !== viewer) return { message: "Only the host can cancel this meetup." };
    if (meetup.status === "open") {
      if (Date.parse(meetup.starts_at) <= Date.now()) {
        return { message: "This meetup has already started." };
      }
      // The service and database must authorize the mutation using the current session.
      await cancelMeetup(meetup.id);
    }
  } catch (error) {
    console.error("Meetup cancellation failed", error);
    return { message: "Couldn’t cancel the meetup. Try again when the meetup service is available." };
  }

  revalidatePath(`/meetups/${encodeURIComponent(id)}`);
  revalidatePath("/meetups");
  revalidatePath("/explore");
  return { success: true };
}
