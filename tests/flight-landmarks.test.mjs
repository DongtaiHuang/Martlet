import assert from "node:assert/strict";
import test from "node:test";
import { LANDMARKS, labelSprite, landmarkSprite, treeSprite } from "../components/game/flight-landmarks.ts";

test("every landmark draws in day and night colours, outlined", () => {
  for (const [i] of LANDMARKS.entries()) {
    const day = landmarkSprite(i, "light");
    const night = landmarkSprite(i, "dark");
    assert.ok(day.w > 40 && day.h > 30, LANDMARKS[i].name);
    assert.equal(day.w, night.w);
    assert.notDeepEqual(day.paths.map((p) => p.fill), night.paths.map((p) => p.fill));
    assert.ok(day.paths.some((p) => p.fill === "#39131d"), `${LANDMARKS[i].name} is outlined`);
  }
  assert.ok(treeSprite("light").h > 10);
});

test("name plates fit their text: 4 pixels a letter plus a border", () => {
  assert.equal(labelSprite("ARTS BUILDING").w, 13 * 4 + 3);
  assert.equal(labelSprite("ARTS BUILDING").h, 9);
});
