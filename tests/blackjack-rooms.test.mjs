import assert from "node:assert/strict";
import test from "node:test";
import { WALL_SIZE, feltTile, roomFor, tileBackground } from "../components/blackjack/rooms.ts";

test("each seeded table has its own room; unknown tables keep the plain table", () => {
  const rooms = ["redpath", "leacock", "bronfman"].map(roomFor);
  for (const room of rooms) {
    assert.ok(room);
    assert.equal(room.wall.w, WALL_SIZE.w);
    assert.equal(room.wall.h, WALL_SIZE.h);
    assert.ok(room.wall.paths.length >= 4, `${room.title} has detail`);
  }
  assert.equal(new Set(rooms.map((r) => r.felt[0])).size, 3, "three different felts");
  assert.equal(new Set(rooms.map((r) => r.title)).size, 3);
  assert.equal(roomFor("somewhere-else"), null);
  assert.equal(roomFor("redpath"), roomFor("redpath"), "rooms are cached");
});

test("tiles render as crisp SVG backgrounds", () => {
  const bg = tileBackground(feltTile(["#111111", "#222222"]), 3);
  assert.match(bg.backgroundImage, /^url\("data:image\/svg\+xml,/);
  assert.equal(bg.backgroundSize, "12px 12px");
  assert.equal(bg.imageRendering, "pixelated");
});
