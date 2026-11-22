import assert from "node:assert/strict";
import test from "node:test";
import { isValidTrendType, validateCreateTrendInput } from "../lib/trend-validation.ts";

const valid = { title: "Le James flat white", type: "coffee", detail: "Great before an 8:30", link: "", campus_location_id: null };
const approved = ["redpath-library", "mclennan-library"];
const parse = (changes) => validateCreateTrendInput({ ...valid, ...changes }, approved);

test("trims titles and enforces title and detail bounds", () => {
  assert.equal(parse({ title: "  Le James  " }).value.title, "Le James");
  assert.ok(parse({ title: "abc" }).ok);
  for (const changes of [
    { title: "ab" },
    { title: "t".repeat(121) },
    { title: "   " },
    { detail: "d".repeat(281) },
  ]) assert.equal(parse(changes).ok, false);
});

test("accepts only the four trend types", () => {
  assert.ok(isValidTrendType("coffee") && isValidTrendType("study") && isValidTrendType("recipe") && isValidTrendType("song"));
  assert.ok(!isValidTrendType("gaming") && !isValidTrendType(undefined));
  assert.equal(parse({ type: "playlist" }).ok, false);
});

test("links must be https or empty", () => {
  assert.ok(parse({ link: "https://open.spotify.com/track/abc" }).ok);
  assert.equal(parse({ link: "http://insecure.example" }).ok, false);
  assert.equal(parse({ link: "javascript:alert(1)" }).ok, false);
  assert.equal(parse({ link: "https://" + "x".repeat(301) }).ok, false);
});

test("campus locations must be approved when present", () => {
  assert.ok(parse({ type: "study", campus_location_id: "redpath-library" }).ok);
  assert.equal(parse({ campus_location_id: "made-up-place" }).ok, false);
});

test("normalises address-free entries and keeps detail optional", () => {
  const result = parse({ detail: "  " });
  assert.ok(result.ok);
  assert.equal(result.value.detail, "");
  assert.equal(result.value.campus_location_id, null);
});
