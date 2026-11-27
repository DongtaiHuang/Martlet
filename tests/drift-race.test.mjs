import assert from "node:assert/strict";
import test from "node:test";
import { readPose } from "../lib/drift-race-pose.ts";

const ok = { seat: 2, x: 120.5, z: -40, h: 1.2, s: 4300.4, p: 3, t: 12.5 };

test("a well-formed pose is read, with the score rounded", () => {
  assert.deepEqual(readPose(ok), { ...ok, s: 4300 });
});

test("poses from a misbehaving browser are dropped", () => {
  for (const bad of [null, "x", { ...ok, seat: 5 }, { ...ok, seat: 1.5 }, { ...ok, x: Infinity }, { ...ok, z: 1e9 },
    { ...ok, s: 1e7 }, { ...ok, p: 16 }, { ...ok, p: -1 }, { ...ok, h: "1" }, { ...ok, t: Number.NaN }]) {
    assert.equal(readPose(bad), null, JSON.stringify(bad));
  }
});
