import assert from "node:assert/strict";
import test from "node:test";
import { isPollOpen, localPollTimeToUtc, validatePoll, votePercentages } from "../lib/poll-validation.ts";

const now = Date.parse("2026-01-01T12:00:00Z");
const valid = { type: "activity", question: "What should we do?", closesAt: "2026-01-01T13:00:00Z", options: ["Coffee", "Games"] };
const approved = ["redpath-library", "mclennan-library"];
const parse = (changes) => validatePoll({ ...valid, ...changes }, approved, now);

test("trims questions and enforces question and choice bounds", () => {
  assert.equal(parse({ question: "  Pick one  " }).data.question, "Pick one");
  assert.ok(parse({ question: "12345", options: ["A", "B", "C", "D", "E"] }).success);
  for (const changes of [
    { question: "    abcd" }, { question: "q".repeat(121) },
    { options: ["A"] }, { options: ["A", "B", "C", "D", "E", "F"] },
    { options: ["    ", "B"] }, { options: ["A", "z".repeat(81)] },
    { options: ["Coffee", " coffee "] },
  ]) assert.equal(parse(changes).success, false);
});

test("accepts canonical location IDs and rejects fabricated or duplicate choices", () => {
  assert.ok(parse({ type: "location", options: approved }).success);
  assert.equal(parse({ type: "location", options: [approved[0], "made-up"] }).success, false);
  assert.equal(parse({ type: "location", options: [approved[0], approved[0]] }).success, false);
});

test("requires UTC future time choices and converts local inputs without accepting nonexistent dates", () => {
  assert.ok(parse({ type: "time", options: ["2026-01-01T14:00:00Z", "2026-01-01T15:00:00Z"] }).success);
  for (const option of ["5:00 PM", "2026-01-01T11:00:00Z", "2026-01-01T14:00:00-05:00", "2026-01-01T14:00:00.000Z"]) {
    assert.equal(parse({ type: "time", options: ["2026-01-01T14:00:00Z", option] }).success, false);
  }
  assert.equal(parse({ closesAt: "2026-01-01T12:00:00Z" }).success, false);
  const oldTimeZone = process.env.TZ;
  try {
    process.env.TZ = "America/Toronto";
    assert.equal(localPollTimeToUtc("2026-01-01T13:30"), "2026-01-01T18:30:00.000Z");
    assert.equal(localPollTimeToUtc("2026-03-08T02:30"), "");
    assert.equal(localPollTimeToUtc("2026-02-30T13:30"), "");
  } finally {
    if (oldTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimeZone;
  }
});

test("rounds percentages to 100 with stable ties and handles zero votes", () => {
  assert.deepEqual(votePercentages([0, 0]), [0, 0]);
  assert.deepEqual(votePercentages([1, 1, 1]), [34, 33, 33]);
  assert.deepEqual(votePercentages([0, 2, 1]), [0, 67, 33]);
});

test("deadline and server-side closure both make a poll read-only", () => {
  assert.equal(isPollOpen(true, valid.closesAt, now), true);
  assert.equal(isPollOpen(false, valid.closesAt, now), false);
  assert.equal(isPollOpen(true, valid.closesAt, Date.parse(valid.closesAt)), false);
  assert.equal(isPollOpen(true, "invalid", now), false);
});
