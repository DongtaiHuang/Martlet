import { z } from "zod";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { MockModeError } from "@/lib/meetups";
import { pollTypeSchema, validatePoll } from "@/lib/poll-validation";
import { AuthRequiredError } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { MeetupPollData } from "@/types/poll";

const idSchema = z.uuid();
const responseSchema = z.object({
  id: idSchema,
  type: pollTypeSchema,
  question: z.string(),
  closesAt: z.iso.datetime({ offset: true }),
  isOpen: z.boolean(),
  isHost: z.boolean(),
  selectedOptionId: idSchema.nullable(),
  options: z.array(z.object({
    id: idSchema,
    label: z.string(),
    proposedAt: z.iso.datetime({ offset: true }).nullable(),
    votes: z.number().int().nonnegative(),
  })).min(2).max(5),
});

export class PollError extends Error {}

async function pollClient() {
  if (getDataMode() === "mock") throw new MockModeError("use polls");
  const client = await createClient();
  const { data, error } = await client.auth.getClaims();
  if (error || !data?.claims.sub) throw new AuthRequiredError("Sign in to use polls.");
  return client;
}

function pollId(value: string) {
  if (!idSchema.safeParse(value).success) throw new PollError("This poll or meetup no longer exists.");
  return value;
}

function databaseError(error: { code: string; message: string }, operation: "read" | "create" | "vote" | "close"): never {
  if (error.code === "42501") throw new PollError("You don’t have permission to do that.");
  if (error.code === "P0002") throw new PollError("This poll or meetup no longer exists.");
  if (error.code === "55000") throw new PollError("This poll is closed.");
  if (error.code === "23505") throw new PollError("This meetup already has a poll, or two of the choices are the same.");
  if (error.code === "22023" || error.code === "22008" || error.code === "22007") {
    throw new PollError(operation === "vote"
      ? "Choose an option from this poll."
      : "Check that the meetup is upcoming, the choices are valid, and voting closes before or at the meetup start.");
  }
  console.error("Meetup poll operation failed", { operation, code: error.code });
  throw new PollError("The poll service is unavailable. Try again later.");
}

export async function getMeetupPoll(meetupId: string): Promise<MeetupPollData | null> {
  if (getDataMode() === "mock") return null;
  const client = await pollClient();
  const { data, error } = await client.rpc("get_meetup_poll_results", { p_meetup_id: pollId(meetupId) });
  if (error) databaseError(error, "read");
  return data === null ? null : responseSchema.parse(data);
}

export async function createMeetupPoll(meetupId: string, input: unknown) {
  const client = await pollClient();
  const parsed = validatePoll(input, CAMPUS_LOCATIONS.map(({ id }) => id));
  if (!parsed.success) throw new PollError(parsed.error.issues[0].message);
  const { type, question, closesAt, options } = parsed.data;
  const { error } = await client.rpc("create_meetup_poll", {
    p_meetup_id: pollId(meetupId), p_type: type, p_question: question, p_closes_at: closesAt, p_options: options,
  });
  if (error) databaseError(error, "create");
}

export async function castMeetupVote(id: string, optionId: string) {
  if (!idSchema.safeParse(optionId).success) throw new PollError("Choose a valid poll option.");
  const client = await pollClient();
  const { data, error } = await client.rpc("cast_meetup_poll_vote", { p_poll_id: pollId(id), p_option_id: optionId });
  if (error) databaseError(error, "vote");
  return idSchema.parse(data);
}

export async function closeMeetupPoll(id: string) {
  const client = await pollClient();
  const { data, error } = await client.rpc("close_meetup_poll", { p_poll_id: pollId(id) });
  if (error) databaseError(error, "close");
  return idSchema.parse(data);
}
