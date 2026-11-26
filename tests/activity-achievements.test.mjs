import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_LADDERS, activityProgress, satisfiedActivityAchievements } from "../lib/activity-achievements.ts";
import { ACHIEVEMENTS } from "../lib/achievement-catalog.ts";

const zero = {
  hosted: 0, joined: 0, flapped: 0,
  unlockedLandmarks: 0, totalLandmarks: 6,
  trendShares: 0, trendLikesReceived: 0,
  creatorProfile: 0, creatorWorks: 0, requestsSent: 0, requestsAccepted: 0,
  listingsPosted: 0, listingsSold: 0,
};

test("every ladder id exists in the catalogue and is not hidden", () => {
  const catalogIds = new Set(ACHIEVEMENTS.map((achievement) => achievement.id));
  for (const ladder of ACTIVITY_LADDERS) {
    assert.ok(catalogIds.has(ladder.id), `${ladder.id} missing from the catalogue`);
    assert.equal(ACHIEVEMENTS.find((achievement) => achievement.id === ladder.id)?.hidden, false);
  }
});

test("zero activity satisfies nothing", () => {
  assert.deepEqual(satisfiedActivityAchievements(zero), []);
  const progress = activityProgress(zero);
  for (const [id, value] of Object.entries(progress)) {
    assert.equal(value.current, 0, `${id} should start at zero`);
  }
});

test("hosting one meetup satisfies only the first hosting ladder", () => {
  const earned = new Set(satisfiedActivityAchievements({ ...zero, hosted: 1 }));
  assert.ok(earned.has("nest-builder"));
  assert.ok(!earned.has("flock-leader"));
});

test("peck, flap, landmark and trend ladders are independent", () => {
  const earned = new Set(satisfiedActivityAchievements({
    ...zero, joined: 10, flapped: 1, unlockedLandmarks: 3, trendShares: 1, trendLikesReceived: 10,
  }));
  for (const id of ["first-flight", "flock-regular", "cheerful-martlet", "campus-explorer", "trendsetter", "campus-taste"]) {
    assert.ok(earned.has(id), `${id} should be earned`);
  }
  for (const id of ["nest-builder", "flock-leader", "standing-ovation", "full-bloom"]) {
    assert.ok(!earned.has(id), `${id} should not be earned yet`);
  }
});

test("progress is capped at the target", () => {
  const progress = activityProgress({ ...zero, hosted: 7, trendLikesReceived: 12 });
  assert.deepEqual(progress["nest-builder"], { current: 1, target: 1 });
  assert.deepEqual(progress["flock-leader"], { current: 5, target: 5 });
  assert.deepEqual(progress["campus-taste"], { current: 10, target: 10 });
});

test("full bloom targets the live landmark total and never a zero target", () => {
  assert.deepEqual(activityProgress({ ...zero, unlockedLandmarks: 2, totalLandmarks: 9 })["full-bloom"], { current: 2, target: 9 });
  assert.deepEqual(activityProgress({ ...zero, totalLandmarks: 0 })["full-bloom"], { current: 0, target: 1 });
});

test("creator and marketplace ladders", () => {
  assert.deepEqual(satisfiedActivityAchievements({ ...zero, creatorProfile: 1, creatorWorks: 2 }), ["open-studio"]);
  assert.deepEqual(
    satisfiedActivityAchievements({ ...zero, creatorProfile: 1, creatorWorks: 3, requestsSent: 1, requestsAccepted: 1, listingsPosted: 2, listingsSold: 1 }).sort(),
    ["commissioned", "gallery", "market-day", "open-studio", "patron", "sold"],
  );
});
