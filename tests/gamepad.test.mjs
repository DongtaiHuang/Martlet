import assert from "node:assert/strict";
import test from "node:test";
import { buttonSprite, dirsAt, dpadSprite } from "../components/pixel/gamepad-sprites.ts";

const dirs = (dx, dy) => [...dirsAt(dx, dy)].sort().join(",");

test("the D-pad reads direction from the thumb's position, with a dead zone and diagonals", () => {
  assert.equal(dirs(0, 0), "");
  assert.equal(dirs(0.1, -0.1), "", "inside the dead zone");
  assert.equal(dirs(-0.9, 0), "left");
  assert.equal(dirs(0.9, 0.1), "right");
  assert.equal(dirs(0, -0.9), "up");
  assert.equal(dirs(0, 0.9), "down");
  assert.equal(dirs(-0.7, -0.7), "left,up");
  assert.equal(dirs(0.7, 0.7), "down,right");
});

test("pressed arms and buttons draw darker, and sprites are cached", () => {
  const idle = dpadSprite(new Set());
  const up = dpadSprite(new Set(["up"]));
  assert.equal(idle.w, 21);
  assert.equal(idle.h, 21);
  assert.notDeepEqual(idle.paths, up.paths);
  assert.equal(dpadSprite(new Set(["up"])), up);
  assert.notDeepEqual(buttonSprite("a", false).paths, buttonSprite("a", true).paths);
  assert.notDeepEqual(buttonSprite("a", false).paths, buttonSprite("b", false).paths);
});
