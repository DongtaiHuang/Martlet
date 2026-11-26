import { getMyCreator, listMyRequests } from "@/lib/creators";
import { listLandmarks } from "@/lib/landmarks";
import { listListings } from "@/lib/marketplace";
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

  const [meetups, trends, landmarks, creator, requests, listings] = await Promise.all([
    listMeetups().catch(() => null),
    listTrends(undefined, 50).catch(() => null),
    listLandmarks().catch(() => null),
    // Creators and the marketplace only exist with an account (preview mode has samples, not yours).
    live ? getMyCreator().catch(() => null) : null,
    live ? listMyRequests().catch(() => null) : null,
    live ? listListings({ mine: true }).catch(() => null) : null,
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
    creatorProfile: creator ? 1 : 0,
    creatorWorks: creator?.works.length ?? 0,
    requestsSent: requests?.sent.length ?? 0,
    requestsAccepted: requests?.received.filter((r) => r.status === "accepted" || r.status === "closed").length ?? 0,
    listingsPosted: listings?.length ?? 0,
    listingsSold: listings?.filter((l) => l.status === "sold").length ?? 0,
  };
}
