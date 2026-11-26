import assert from "node:assert/strict";
import test from "node:test";
import { cardInfo, handValue, isBlackjack, isSoft, payoutFor, practiceAction, practiceDeal, practiceView, shuffledDeck } from "../lib/blackjack-engine.ts";

// A deck that starts with the given cards; the rest follow in order. Same helper as the SQL test.
const deck = (...first) => [...first, ...Array.from({ length: 52 }, (_, i) => i).filter((c) => !first.includes(c))];

test("card names", () => {
  assert.deepEqual(cardInfo(0), { rank: "A", suit: "♠", red: false, name: "Ace of spades" });
  assert.equal(cardInfo(25).name, "King of hearts");
  assert.equal(cardInfo(35).rank, "10");
  assert.equal(cardInfo(51).name, "King of clubs");
});

test("hand values match the SQL function", () => {
  assert.equal(handValue([0, 12]), 21);
  assert.equal(handValue([0, 0]), 12);
  assert.equal(handValue([0, 0, 12]), 12);
  assert.equal(handValue([0, 5, 9]), 17);
  assert.equal(handValue([9, 10, 11]), 30);
  assert.equal(isSoft([0, 5]), true);
  assert.equal(isSoft([0, 5, 9]), false);
  assert.equal(isBlackjack([0, 12]), true);
  assert.equal(isBlackjack([4, 5, 9]), false);
});

test("payouts", () => {
  assert.equal(payoutFor("blackjack", 15), 37);
  assert.equal(payoutFor("win", 10), 20);
  assert.equal(payoutFor("push", 10), 10);
  assert.equal(payoutFor("lose", 10), 0);
  assert.equal(payoutFor("bust", 10), 0);
});

test("practice hands follow the same rules as the SQL test", () => {
  let h = practiceDeal(10, deck(9, 22, 8, 6));
  assert.equal(practiceView(h, "x", 0).dealer.length, 1, "hole card hidden");
  assert.equal(practiceAction(h, "stand").result, "win");
  assert.equal(practiceDeal(15, deck(0, 9, 12, 5)).result, "blackjack");
  assert.equal(practiceDeal(10, deck(9, 0, 22, 12)).result, "lose");
  assert.equal(practiceDeal(10, deck(0, 13, 12, 25)).result, "push");
  assert.equal(practiceAction(practiceDeal(10, deck(9, 22, 5, 6, 35)), "hit").result, "bust");
  h = practiceAction(practiceDeal(20, deck(4, 22, 5, 3, 9, 1)), "double");
  assert.deepEqual([h.result, h.bet, handValue(h.player), handValue(h.dealer), h.dealer.length], ["win", 40, 21, 17, 4]);
  assert.equal(practiceAction(practiceDeal(10, deck(9, 22, 7, 20)), "stand").result, "push");
});

test("shuffles use every card once", () => {
  const d = shuffledDeck();
  assert.equal(d.length, 52);
  assert.equal(new Set(d).size, 52);
});

test("splitting pairs follows the same rules as the SQL split test", () => {
  // 8 8 vs 10 7: split, double hand 1 into 21, stand on 18. Both win.
  let h = practiceDeal(10, deck(7, 9, 20, 6, 2, 22, 12));
  assert.equal(practiceView(h, "x", 0).can_split, true);
  h = practiceAction(h, "split");
  let v = practiceView(h, "x", 0);
  assert.deepEqual([v.split, v.active, v.player_value, v.split_value, v.can_split, v.can_double], [true, 1, 11, 18, false, true]);
  assert.equal(practiceAction(h, "split"), h, "split only once");
  h = practiceAction(h, "double");
  assert.deepEqual([h.active, h.bet, handValue(h.player), h.result], [2, 20, 21, null]);
  h = practiceAction(h, "stand");
  v = practiceView(h, "x", 0);
  assert.deepEqual([v.result, v.split_result, v.payout, v.total_bet], ["win", "win", 60, 30]);

  // Split aces: one card each, then settle. A K after a split is a plain win.
  h = practiceAction(practiceDeal(10, deck(0, 9, 13, 6, 12, 4)), "split");
  assert.deepEqual([h.result, h.splitResult, practiceView(h, "x", 0).payout], ["win", "lose", 20]);

  // Hand 1 busts; hand 2 still plays and the dealer draws for it.
  h = practiceAction(practiceAction(practiceDeal(10, deck(7, 9, 20, 5, 4, 22, 12, 25)), "split"), "hit");
  assert.equal(h.active, 2);
  h = practiceAction(h, "stand");
  assert.deepEqual([h.result, h.splitResult, h.dealer.length], ["bust", "win", 3]);

  // K Q is not a pair.
  h = practiceDeal(10, deck(12, 9, 11, 6));
  assert.equal(practiceView(h, "x", 0).can_split, false);
  assert.equal(practiceAction(h, "split"), h);
});
