import assert from "node:assert/strict";
import test from "node:test";
import { ALTITUDE, BOUNDS, START, angleDiff, bearingDeg, distanceM, nearest, step, zoomFor } from "../components/game/skies/skies-math.ts";
import { BACK_H, BACK_W, backFrames } from "../components/game/skies/skies-sprites.ts";

const idle = { left: false, right: false, up: false, down: false, boost: false };

test("distance and bearing on campus scale", () => {
  // Roddick Gates to Redpath Museum is a few hundred metres north-west.
  const d = distanceM(-73.5772, 45.5043, -73.5793, 45.5059); // fixed points, not START
  assert.ok(d > 200 && d < 260, `got ${d}`);
  assert.equal(Math.round(bearingDeg(0, 45, 0, 45.001)), 0);
  assert.equal(Math.round(bearingDeg(0, 45, 0.001, 45)), 90);
  assert.equal(angleDiff(350, 10), 20);
  assert.equal(angleDiff(10, 350), -20);
});

test("flying straight north moves north at cruise speed", () => {
  const b = step({ ...START, heading: 0 }, idle, 1);
  assert.ok(Math.abs(distanceM(START.lng, START.lat, b.lng, b.lat) - 22) < 0.5);
  assert.ok(b.lat > START.lat);
  assert.equal(b.heading, 0);
});

test("steering, climbing and boosting", () => {
  assert.equal(step({ ...START, heading: 0 }, { ...idle, right: true }, 0.5).heading, 40);
  assert.equal(step({ ...START, heading: 0 }, { ...idle, left: true }, 0.5).heading, 320);
  assert.equal(step(START, { ...idle, up: true }, 10).altitude, ALTITUDE.max);
  assert.equal(step(START, { ...idle, down: true }, 10).altitude, ALTITUDE.min);
  const fast = step({ ...START, heading: 90 }, { ...idle, boost: true }, 1);
  assert.ok(distanceM(START.lng, START.lat, fast.lng, fast.lat) > 40);
});

test("the bird stays inside the campus and turns back at the edge", () => {
  let b = { ...START, heading: 0 };
  let sawEdge = false;
  for (let i = 0; i < 4000; i++) { b = step(b, idle, 0.05); sawEdge ||= b.atEdge; }
  assert.ok(sawEdge);
  assert.ok(b.lat <= BOUNDS.north && b.lat >= BOUNDS.south && b.lng <= BOUNDS.east && b.lng >= BOUNDS.west);
});

test("zoom falls as the bird climbs; nearest picks the closest place", () => {
  assert.ok(zoomFor(ALTITUDE.min) > zoomFor(ALTITUDE.max));
  const places = [{ id: "far", longitude: -73.58, latitude: 45.51 }, { id: "near", longitude: -73.5773, latitude: 45.5044 }];
  assert.equal(nearest(START, places)?.place.id, "near");
  assert.equal(nearest(START, []), null);
});

test("the back-view bird has three 26 x 13 frames in any plumage", () => {
  for (const p of [{ id: "marty", body: "#9c2334", wing: "#751e2c" }, { id: "teal", body: "#134e4a", wing: "#0d3a37" }]) {
    for (const s of Object.values(backFrames(p))) { assert.equal(s.w, BACK_W); assert.equal(s.h, BACK_H); }
  }
});
