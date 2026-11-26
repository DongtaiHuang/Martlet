// Activity-ladder achievements (ADR 0020): server-computed from activity the
// student already generated, saved through the same user_achievements path as
// the discovery badges (ADR 0019). The catalogue (lib/achievement-catalog.ts)
// owns titles and ids; this module owns the thresholds.
//
// Runtime dependency-free on purpose so node --test can import it directly
// (the achievement-catalog import is type-only and erased at runtime).

import type { AchievementId } from "./achievement-catalog";

export interface ActivityCounts {
  /** Meetups the student hosts. */
  hosted: number;
  /** Meetups the student pecked (joined). */
  joined: number;
  /** Meetups the student flapped (cheered). */
  flapped: number;
  unlockedLandmarks: number;
  totalLandmarks: number;
  /** Trend entries the student shared (within the ranked list the app loads). */
  trendShares: number;
  /** Likes received across those entries (within the ranked list the app loads). */
  trendLikesReceived: number;
  /** Creator directory (ADR 0042): 1 with a profile, its works, requests sent and accepted. */
  creatorProfile: number;
  creatorWorks: number;
  requestsSent: number;
  requestsAccepted: number;
  /** Marketplace (ADR 0040): the student's listings and how many are sold. */
  listingsPosted: number;
  listingsSold: number;
}

export type ActivityProgress = Partial<Record<AchievementId, { current: number; target: number }>>;

interface Ladder {
  id: AchievementId;
  target: (counts: ActivityCounts) => number;
  current: (counts: ActivityCounts) => number;
}

export const ACTIVITY_LADDERS: readonly Ladder[] = [
  { id: "nest-builder", target: () => 1, current: (c) => c.hosted },
  { id: "flock-leader", target: () => 5, current: (c) => c.hosted },
  { id: "first-flight", target: () => 1, current: (c) => c.joined },
  { id: "flock-regular", target: () => 10, current: (c) => c.joined },
  { id: "cheerful-martlet", target: () => 1, current: (c) => c.flapped },
  { id: "standing-ovation", target: () => 25, current: (c) => c.flapped },
  { id: "campus-explorer", target: () => 3, current: (c) => c.unlockedLandmarks },
  { id: "full-bloom", target: (c) => Math.max(c.totalLandmarks, 1), current: (c) => c.unlockedLandmarks },
  { id: "trendsetter", target: () => 1, current: (c) => c.trendShares },
  { id: "campus-taste", target: () => 10, current: (c) => c.trendLikesReceived },
  { id: "open-studio", target: () => 1, current: (c) => c.creatorProfile },
  { id: "gallery", target: () => 3, current: (c) => c.creatorWorks },
  { id: "patron", target: () => 1, current: (c) => c.requestsSent },
  { id: "commissioned", target: () => 1, current: (c) => c.requestsAccepted },
  { id: "market-day", target: () => 1, current: (c) => c.listingsPosted },
  { id: "sold", target: () => 1, current: (c) => c.listingsSold },
];

/** Catalogue ids whose ladder the counts already satisfy (candidates to earn). */
export function satisfiedActivityAchievements(counts: ActivityCounts): AchievementId[] {
  return ACTIVITY_LADDERS
    .filter((ladder) => ladder.current(counts) >= ladder.target(counts))
    .map((ladder) => ladder.id);
}

/** Current/target pairs for every activity ladder, for progress display. Capped at target. */
export function activityProgress(counts: ActivityCounts): ActivityProgress {
  const progress: ActivityProgress = {};
  for (const ladder of ACTIVITY_LADDERS) {
    progress[ladder.id] = {
      current: Math.min(ladder.current(counts), ladder.target(counts)),
      target: ladder.target(counts),
    };
  }
  return progress;
}
