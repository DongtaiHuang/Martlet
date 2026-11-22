import type { CreateMeetupInput, Meetup, MeetupSummary } from "@/types/meetup";
import { getMockMeetups } from "@/lib/mock-meetups";
import { validateCreateMeetupInput, type MeetupFieldErrors } from "@/lib/meetup-validation";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { AuthRequiredError, requireUser } from "@/lib/supabase/auth";

// Server-only meetup service (uses the cookie-bound Supabase server client).
// Call it from Server Components, Server Actions, or Route Handlers, never from "use client" code.
//
// Data mode is decided once from the environment (see lib/supabase/env.ts):
// - live: every call goes to Supabase; errors are thrown, never replaced by mock data.
// - mock: reads return lib/mock-meetups.ts; writes throw MockModeError.

export { AuthRequiredError };
export { getDataMode as getMeetupDataMode } from "@/lib/supabase/env";

export class MockModeError extends Error {
  constructor(action: string) {
    super(`Cannot ${action}: Supabase is not configured, so Martlet is running in read-only mock mode.`);
    this.name = "MockModeError";
  }
}

export class MeetupValidationError extends Error {
  readonly fieldErrors: MeetupFieldErrors;

  constructor(fieldErrors: MeetupFieldErrors) {
    super(Object.values(fieldErrors)[0] ?? "Invalid meetup.");
    this.name = "MeetupValidationError";
    this.fieldErrors = fieldErrors;
  }
}

export class MeetupNotFoundError extends Error {
  constructor(message = "Meetup not found.") {
    super(message);
    this.name = "MeetupNotFoundError";
  }
}

const MEETUP_COLUMNS =
  "id, host_id, title, description, category, location_name, latitude, longitude, starts_at, status, created_at, course_code";

// `profiles!host_id` disambiguates the host relation from the many-to-many paths
// through meetup_pecks / meetup_flaps. `(count)` returns an aggregate, not rows.
const SUMMARY_SELECT =
  `${MEETUP_COLUMNS}, host:profiles!host_id(display_name), pecks:meetup_pecks(count), flaps:meetup_flaps(count)`;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FEED_LIMIT = 100;

type SummaryRow = Meetup & {
  host: { display_name: string } | { display_name: string }[] | null;
  pecks: { count: number }[] | null;
  flaps: { count: number }[] | null;
};

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function firstCount(value: { count: number }[] | null): number {
  return value?.[0]?.count ?? 0;
}

function hostName(host: SummaryRow["host"]): string {
  const row = Array.isArray(host) ? host[0] : host;
  return row?.display_name ?? "Martlet Student";
}

async function currentUserId(supabase: SupabaseServerClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getClaims();
  return error ? null : (data?.claims?.sub ?? null);
}

/** Looks up which of `meetupIds` the current user has pecked / flapped. */
async function userReactions(
  supabase: SupabaseServerClient,
  userId: string | null,
  meetupIds: string[],
): Promise<{ pecked: Set<string>; flapped: Set<string> }> {
  if (!userId || meetupIds.length === 0) return { pecked: new Set(), flapped: new Set() };

  const [pecks, flaps] = await Promise.all([
    supabase.from("meetup_pecks").select("meetup_id").eq("user_id", userId).in("meetup_id", meetupIds),
    supabase.from("meetup_flaps").select("meetup_id").eq("user_id", userId).in("meetup_id", meetupIds),
  ]);
  if (pecks.error) throw new Error(`Failed to load your pecks: ${pecks.error.message}`);
  if (flaps.error) throw new Error(`Failed to load your flaps: ${flaps.error.message}`);

  return {
    pecked: new Set(pecks.data.map((row) => row.meetup_id as string)),
    flapped: new Set(flaps.data.map((row) => row.meetup_id as string)),
  };
}

function toSummary(
  row: SummaryRow,
  reactions: { pecked: Set<string>; flapped: Set<string> },
): MeetupSummary {
  const { host, pecks, flaps, ...meetup } = row;
  return {
    ...meetup,
    host_display_name: hostName(host),
    attendee_count: 1 + firstCount(pecks), // host is an implicit participant
    flap_count: firstCount(flaps),
    has_pecked: reactions.pecked.has(row.id),
    has_flapped: reactions.flapped.has(row.id),
  };
}

/** Upcoming open meetups, soonest first. Empty when signed out (RLS allows reads only to signed-in users). */
export async function listMeetups(): Promise<MeetupSummary[]> {
  if (getDataMode() === "mock") return getMockMeetups();

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return [];

  const { data, error } = await supabase
    .from("meetups")
    .select(SUMMARY_SELECT)
    .eq("status", "open")
    .gt("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(FEED_LIMIT)
    .returns<SummaryRow[]>();
  if (error) throw new Error(`Failed to load meetups: ${error.message}`);

  const reactions = await userReactions(supabase, userId, data.map((row) => row.id));
  return data.map((row) => toSummary(row, reactions));
}

/** Any meetup by id, including cancelled or past ones (for the detail page). */
export async function getMeetup(id: string): Promise<MeetupSummary | null> {
  if (getDataMode() === "mock") return getMockMeetups().find((m) => m.id === id) ?? null;
  if (!UUID_PATTERN.test(id)) return null;

  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId) return null;

  const { data, error } = await supabase
    .from("meetups")
    .select(SUMMARY_SELECT)
    .eq("id", id)
    .maybeSingle<SummaryRow>();
  if (error) throw new Error(`Failed to load meetup: ${error.message}`);
  if (!data) return null;

  return toSummary(data, await userReactions(supabase, userId, [data.id]));
}

/**
 * Creates a meetup hosted by the signed-in user.
 * Throws AuthRequiredError, MeetupValidationError, or MockModeError.
 */
export async function createMeetup(input: CreateMeetupInput): Promise<Meetup> {
  if (getDataMode() === "mock") throw new MockModeError("create a meetup");

  const result = validateCreateMeetupInput(input);
  if (!result.ok) throw new MeetupValidationError(result.errors);

  const user = await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetups")
    // host_id comes from the verified session, never from the caller.
    .insert({ ...result.value, host_id: user.id })
    .select(MEETUP_COLUMNS)
    .single<Meetup>();

  if (error) {
    if (error.code === "42501") throw new AuthRequiredError("You are not allowed to create this meetup.");
    if (error.code === "23503" && error.message.includes("course_code")) {
      throw new MeetupValidationError({ course_code: `${result.value.course_code} isn’t a McGill course.` });
    }
    if (error.code === "23514" || error.code === "23503") {
      throw new MeetupValidationError({ form: "The meetup did not pass server validation." });
    }
    throw new Error(`Failed to create meetup: ${error.message}`);
  }
  return data;
}

/**
 * Cancels a meetup. Only its host may cancel; cancelling twice is a no-op.
 * Throws AuthRequiredError, MeetupNotFoundError (also when the caller is not the host), or MockModeError.
 */
export async function cancelMeetup(id: string): Promise<void> {
  if (getDataMode() === "mock") throw new MockModeError("cancel a meetup");

  const user = await requireUser();
  if (!UUID_PATTERN.test(id)) throw new MeetupNotFoundError();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("meetups")
    .update({ status: "cancelled" })
    .eq("id", id)
    .eq("host_id", user.id)
    .select("id");
  if (error) throw new Error(`Failed to cancel meetup: ${error.message}`);
  if (data.length === 0) throw new MeetupNotFoundError("Meetup not found, or you are not its host.");
}
