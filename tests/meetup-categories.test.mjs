import assert from "node:assert/strict";
import test from "node:test";
import { filterMeetupsByCategory, meetupCategoriesSchema } from "../lib/meetup-categories.ts";

test("accepts one to three categories and preserves selection order", () => {
  for (const categories of [["other"], ["coffee"], ["coffee", "study"], ["gaming", "food", "sports"]]) {
    assert.deepEqual(meetupCategoriesSchema.parse(categories), categories);
  }
});

test("rejects invalid lengths, values, duplicates and combinations with Other", () => {
  for (const categories of [[], ["coffee", "food", "study", "sports"], ["coffee", "coffee"],
    ["other", "study"], ["food", "other"], ["social"], [null], "coffee"]) {
    assert.equal(meetupCategoriesSchema.safeParse(categories).success, false);
  }
});

test("filtering finds secondary categories and preserves one result per meetup", () => {
  const coffeeStudy = { id: "coffee-study", categories: ["coffee", "study"] };
  const other = { id: "other", categories: ["other"] };
  const meetups = [coffeeStudy, other];
  assert.deepEqual(filterMeetupsByCategory(meetups, "coffee"), [coffeeStudy]);
  assert.deepEqual(filterMeetupsByCategory(meetups, "study"), [coffeeStudy]);
  assert.deepEqual(filterMeetupsByCategory(meetups, "sports"), []);
  assert.deepEqual(filterMeetupsByCategory(meetups, "all"), meetups);
});
