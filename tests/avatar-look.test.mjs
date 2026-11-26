import assert from "node:assert/strict";
import test from "node:test";
import { parseLook, plumageOf } from "../components/avatar/look.ts";

test("valid looks round-trip", () => {
  assert.deepEqual(parseLook(JSON.stringify({ plumage: "teal", wearing: ["scarf", "beanie"] })), { plumage: "teal", wearing: ["scarf", "beanie"] });
});

test("missing, malformed or unknown data is rejected", () => {
  for (const raw of [null, "", "not json", "42", "null", JSON.stringify({ plumage: "rainbow", wearing: [] }), JSON.stringify({ plumage: "teal" })]) {
    assert.equal(parseLook(raw), null, String(raw));
  }
});

test("unknown and duplicate items are dropped, and only one hat is kept", () => {
  const look = parseLook(JSON.stringify({ plumage: "gold", wearing: ["scarf", "jetpack", "scarf", 7, "beanie", "gradcap"] }));
  assert.deepEqual(look, { plumage: "gold", wearing: ["scarf", "beanie"] });
});

test("plumageOf returns the plumage colours", () => {
  assert.equal(plumageOf({ plumage: "classic", wearing: [] }).body, "#1f2a44");
  assert.equal(plumageOf({ plumage: "marty", wearing: [] }).body, "#9c2334");
  assert.equal(plumageOf({ plumage: "crimson", wearing: [] }).id, "crimson");
});
