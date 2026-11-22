import { listLandmarks } from "@/lib/landmarks";
import { listMeetups } from "@/lib/meetups";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { listTrends } from "@/lib/trends";
import type { ActivityCounts } from "@/lib/activity-achievements";

// Server-only loader that assembles the counts behind the activity ladders
// (ADR 0020) from the services the app already uses. Read-only: earning still
// goes through the shared earn()/user_achievements path from ADR 0019.

/**
 * The signed-in student's activity counts, or null when they can't be read
 * (signed out in live mode — RLS hides everything).
 */
export async function loadActivityCounts(): Promise<ActivityCounts | null> {
  const live = getDataMode() === "live";
  const viewer = live ? await getCurrentUser().catch(() => null) : null;
  if (live && !viewer) return null;

  const [meetups, trends, landmarks] = await Promise.all([
    listMeetups().catch(() => null),
    listTrends(undefined, 50).catch(() => null),
    listLandmarks().catch(() => null),
  ]);

  return {
    hosted: meetups?.filter((meetup) => meetup.host_id === viewer?.id).length ?? 0,
    joined: meetups?.filter((meetup) => meetup.has_pecked).length ?? 0,
    flapped: meetups?.filter((meetup) => meetup.has_flapped).length ?? 0,
    unlockedLandmarks: landmarks?.filter((landmark) => landmark.unlocked).length ?? 0,
    totalLandmarks: landmarks?.length ?? 0,
    // Top-50 window: entries that fell out of the ranked list stop counting.
    trendShares: trends?.filter((trend) => trend.createdByMe).length ?? 0,
    trendLikesReceived: trends?.filter((trend) => trend.createdByMe).reduce((sum, trend) => sum + trend.likeCount, 0) ?? 0,
  };
}
