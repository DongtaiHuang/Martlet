import assert from "node:assert/strict";
import test from "node:test";
import { CARD_BACK, CARD_H, CARD_W, cardFace, chipSprite } from "../components/blackjack/pixel-cards.ts";

const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];
const SUITS = [["♠", false], ["♥", true], ["♦", true], ["♣", false]];

test("every card face is a 20 x 30 sprite in the right ink colour", () => {
  for (const rank of RANKS) for (const [suit, red] of SUITS) {
    const s = cardFace(rank, suit, red);
    assert.equal(s.w, CARD_W, `${rank}${suit}`);
    assert.equal(s.h, CARD_H, `${rank}${suit}`);
    const fills = s.paths.map((p) => p.fill);
    assert.ok(fills.includes(red ? "#c0263a" : "#26222e"), `${rank}${suit} ink`);
    assert.ok(!fills.includes(red ? "#26222e" : "#c0263a"), `${rank}${suit} has one ink`);
  }
  assert.equal(cardFace("A", "♠", false), cardFace("A", "♠", false), "faces are cached");
});

test("different cards draw differently", () => {
  const d = (r, s, red) => cardFace(r, s, red).paths.map((p) => p.d).join("|");
  assert.notEqual(d("A", "♠", false), d("K", "♠", false));
  assert.notEqual(d("A", "♠", false), d("A", "♣", false));
  assert.notEqual(d("A", "♥", true), d("A", "♦", true));
});

test("the back and chips are sprites too", () => {
  assert.equal(CARD_BACK.w, CARD_W);
  assert.equal(CARD_BACK.h, CARD_H);
  const colours = new Set([5, 10, 25, 50, 100].map((v) => chipSprite(v).paths.find((p) => p.d.includes("M2 2"))?.fill ?? chipSprite(v).paths[1].fill));
  assert.equal(colours.size, 5, "each chip value has its own colour");
});
