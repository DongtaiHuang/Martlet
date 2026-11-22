"use server";

import { revalidatePath } from "next/cache";
import { castMeetupVote, closeMeetupPoll, createMeetupPoll, PollError } from "@/lib/polls";
import { AuthRequiredError } from "@/lib/supabase/auth";

export type PollActionState = { error?: string; message?: string };

function actionError(error: unknown): PollActionState {
  return {
    error: error instanceof PollError || error instanceof AuthRequiredError
      ? error.message
      : "Couldn’t update this poll. Refresh and try again.",
  };
}

export async function submitPoll(meetupId: string, _state: PollActionState, formData: FormData): Promise<PollActionState> {
  try {
    await createMeetupPoll(meetupId, {
      type: formData.get("type"),
      question: formData.get("question"),
      closesAt: formData.get("closesAt"),
      options: formData.getAll("option"),
    });
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(`/meetups/${encodeURIComponent(meetupId)}`);
  return { message: "Poll created." };
}

export async function submitPollVote(pollId: string, _state: PollActionState, formData: FormData): Promise<PollActionState> {
  const intent = formData.get("intent");
  let meetupId: string;
  try {
    if (intent === "close") {
      meetupId = await closeMeetupPoll(pollId);
    } else if (intent === "vote") {
      const option = formData.get("option");
      if (typeof option !== "string") return { error: "Choose an option before voting." };
      meetupId = await castMeetupVote(pollId, option);
    } else {
      return { error: "Choose a valid poll action." };
    }
  } catch (error) {
    return actionError(error);
  }
  revalidatePath(`/meetups/${encodeURIComponent(meetupId)}`);
  return { message: intent === "close" ? "Poll closed." : "Vote saved." };
}
