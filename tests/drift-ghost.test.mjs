import assert from "node:assert/strict";
import test from "node:test";
import { encodeSample, ghostAt, ghostChoices } from "../lib/drift-ghost.ts";

test("samples round to what the database stores and fit smallints", () => {
  assert.deepEqual(encodeSample(12.34, -5.67, 1.5, 12345), [123, -57, 1500, 1234]);
  const wrapped = encodeSample(0, 0, 7 * Math.PI, 0); // headings wrap to -π..π
  assert.ok(Math.abs(wrapped[2]) <= 3142);
  assert.equal(encodeSample(0, 0, 0, 999_999)[3], 20700);
});

test("ghostAt interpolates position and score, and holds the last sample", () => {
  const path = [...encodeSample(0, 0, 0, 0), ...encodeSample(2, 4, 0, 1000)];
  assert.deepEqual(ghostAt(path, 0.05), { x: 1, z: 2, heading: 0, score: 500 });
  assert.deepEqual(ghostAt(path, 99), { x: 2, z: 4, heading: 0, score: 1000 });
  assert.equal(ghostAt([], 1), null);
});

test("headings interpolate the short way round", () => {
  const path = [...encodeSample(0, 0, 3.1, 0), ...encodeSample(0, 0, -3.1, 0)];
  const mid = ghostAt(path, 0.05);
  assert.ok(Math.abs(Math.abs(mid.heading) - Math.PI) < 0.05, `got ${mid.heading}`);
});

test("ghostChoices adds your own ghost once and sorts best first", () => {
  const g = (name, score, me = false) => ({ name, score, paint: 0, path: [], me });
  assert.deepEqual(ghostChoices([g("Maya", 9000)], g("You", 12000, true)).map((x) => x.name), ["You", "Maya"]);
  assert.equal(ghostChoices([g("You", 12000, true)], g("You", 12000, true)).length, 1);
  assert.deepEqual(ghostChoices([], null), []);
});
