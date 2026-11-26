import assert from "node:assert/strict";
import test from "node:test";
import { grid, outlined, overlay, mirrored, toSprite, spriteSvg } from "../lib/pixel/sprite.ts";
import { MARTY, martletRamp, shade } from "../lib/pixel/palette.ts";
import { BIRD_H, BIRD_PAD, BIRD_W, birdFrames, numberSprite } from "../components/game/flight-sprites.ts";

test("toSprite turns row runs into one path per colour, in palette order", () => {
  const s = toSprite(grid(["AAB", ".A."]), { A: "#111111", B: "#222222" });
  assert.equal(s.w, 3);
  assert.equal(s.h, 2);
  assert.deepEqual(s.paths, [
    { fill: "#111111", d: "M0 0h2v1h-2zM1 1h1v1h-1z" },
    { fill: "#222222", d: "M2 0h1v1h-1z" },
  ]);
  assert.match(spriteSvg(s), /shape-rendering="crispEdges"/);
});

test("outlined, overlay and mirrored edit grids without touching the input", () => {
  const g = grid(["...", ".A.", "..."]);
  assert.deepEqual(outlined(g, "K").map((r) => r.join("")), [".K.", "KAK", ".K."]);
  assert.deepEqual(overlay(g, grid(["B."]), 1, 2).map((r) => r.join("")), ["...", ".A.", ".B."]);
  assert.deepEqual(mirrored(grid(["AB."])).map((r) => r.join("")), [".BA"]);
  assert.deepEqual(g.map((r) => r.join("")), ["...", ".A.", "..."]);
});

test("shade mixes towards white or black", () => {
  assert.equal(shade("#808080", 1), "#ffffff");
  assert.equal(shade("#808080", -1), "#000000");
  assert.equal(shade("#9c2334", 0), "#9c2334");
});

test("Marty's own plumage keeps his exact colours; others share his outline", () => {
  assert.equal(martletRamp("#9c2334", "#751e2c", true).cap, MARTY.cap);
  const marty = birdFrames({ id: "marty", body: "#9c2334", wing: "#751e2c" }, []);
  const navy = birdFrames({ id: "classic", body: "#1f2a44", wing: "#151d33" }, ["beanie"]);
  for (const frames of [marty, navy]) {
    for (const s of Object.values(frames)) {
      assert.equal(s.w, BIRD_W);
      assert.equal(s.h, BIRD_H + BIRD_PAD);
      assert.ok(s.paths.some((p) => p.fill === MARTY.outline));
    }
  }
  assert.ok(navy.mid.paths.some((p) => p.fill === "#a6192e"), "the beanie is drawn");
  assert.equal(birdFrames({ id: "marty", body: "#9c2334", wing: "#751e2c" }, []), marty, "frames are cached per look");
});

test("numberSprite is 4 pixels per digit plus an outline", () => {
  assert.equal(numberSprite(7).w, 5);
  assert.equal(numberSprite(42).w, 9);
  assert.equal(numberSprite(42).h, 7);
});
