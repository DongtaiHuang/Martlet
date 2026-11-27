import assert from "node:assert/strict";
import test from "node:test";
import { TRACK_IDS, TRACKS, isTrackId, signAt } from "../lib/drift-tracks.ts";

test("every track has a sign for every point and a closed, evenly spaced loop", () => {
  for (const id of TRACK_IDS) {
    const t = TRACKS[id];
    assert.equal(t.signOfPoint.length, t.loop.length, id);
    for (let i = 0; i < 200; i++) assert.ok(t.signs.includes(signAt(id, i, 200)), `${id} ${i}`);
    for (let i = 0; i < t.loop.length; i++) {
      const [ax, az] = t.loop[i], [bx, bz] = t.loop[(i + 1) % t.loop.length];
      assert.ok(Math.hypot(bx - ax, bz - az) < 45, `${id} gap at ${i}`);
    }
  }
});

test("the campus loop goes through the Roddick Gates", () => {
  assert.ok(TRACKS.campus.signs.includes("Roddick Gates"));
  assert.equal(signAt("campus", 0, 100), "Rue Sherbrooke O.");
});

test("only known tracks are accepted", () => {
  assert.ok(isTrackId("campus"));
  assert.ok(!isTrackId("rally-cross"));
  assert.ok(!isTrackId(undefined));
});
