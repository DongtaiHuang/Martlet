import type { Meetup } from "@/types/meetup";
import { requireUser } from "@/lib/supabase/auth";
import { createClient } from "@/lib/supabase/server";

export type ProfileHistoryMeetup = Pick<Meetup, "id" | "title" | "category" | "starts_at" | "location_name" | "status">;

const HISTORY_COLUMNS = "id,title,category,starts_at,location_name,status";
export const PROFILE_HISTORY_LIMIT = 25;

export async function listProfileMeetupHistory() {
  const { id } = await requireUser();
  const supabase = await createClient();
  const historyFilter = `starts_at.lte.${new Date().toISOString()},status.eq.cancelled`;

  const [hosted, joined] = await Promise.all([
    supabase.from("meetups")
      .select(HISTORY_COLUMNS)
      .eq("host_id", id)
      .or(historyFilter)
      .order("starts_at", { ascending: false })
      .order("id")
      .limit(PROFILE_HISTORY_LIMIT)
      .returns<ProfileHistoryMeetup[]>(),
    // An inner embed filters on the student's current Peck without returning participant data.
    supabase.from("meetups")
      .select(`${HISTORY_COLUMNS},meetup_pecks!inner()`)
      .eq("meetup_pecks.user_id", id)
      .neq("host_id", id)
      .or(historyFilter)
      .order("starts_at", { ascending: false })
      .order("id")
      .limit(PROFILE_HISTORY_LIMIT)
      .returns<ProfileHistoryMeetup[]>(),
  ]);

  if (hosted.error) throw new Error("Could not load hosted meetup history", { cause: hosted.error });
  if (joined.error) throw new Error("Could not load joined meetup history", { cause: joined.error });
  return { hosted: hosted.data, joined: joined.data };
}
