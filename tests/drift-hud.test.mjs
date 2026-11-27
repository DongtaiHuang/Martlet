import assert from "node:assert/strict";
import test from "node:test";
import { buildTrack } from "../lib/drift.ts";
import { passing, streetAt } from "../lib/drift-hud.ts";
import { STREET_LOOP, STREET_OF_POINT } from "../lib/drift-streets.ts";

test("the loop runs Sherbrooke, University, Pine, McTavish and back", () => {
  const order = STREET_OF_POINT.filter((s, i) => i === 0 || s !== STREET_OF_POINT[i - 1]);
  assert.deepEqual(order, [0, 1, 2, 3, 0]);
  assert.equal(STREET_OF_POINT.length, STREET_LOOP.length);
});

test("streetAt maps dense track points back to streets", () => {
  const track = buildTrack(STREET_LOOP);
  const n = track.points.length;
  assert.equal(streetAt(0, n).short, "Sherbrooke");
  assert.equal(streetAt(n - 1, n).short, "Sherbrooke");
  const seen = new Set(Array.from({ length: n }, (_, i) => streetAt(i, n).short));
  assert.deepEqual([...seen].sort(), ["McTavish", "Pine", "Sherbrooke", "University"]);
});

test("passing names the nearest building within range, by its outline", () => {
  const square = (name, x, z) => ({ name, points: [{ x, z }, { x: x + 20, z }, { x: x + 20, z: z + 20 }, { x, z: z + 20 }] });
  const buildings = [square("Leacock Building", 0, 0), square("Arts Building", 100, 0)];
  assert.equal(passing(-10, 10, buildings), "Leacock Building"); // 10 m from Leacock's wall
  assert.equal(passing(130, 10, buildings), "Arts Building");
  assert.equal(passing(60, 10, buildings), null); // 40 m from both
  assert.equal(passing(0, 0, []), null);
});
