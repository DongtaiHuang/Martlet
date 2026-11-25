import assert from "node:assert/strict";
import test from "node:test";
import { applyTrade, cost, pointsForShares, probability, sharesForPoints } from "../lib/market-math.ts";

const fresh = { b: 100, yes: 0, no: 0 };
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("a new market starts at 50%", () => {
  close(probability(fresh), 0.5);
  close(cost(fresh), 100 * Math.log(2));
});

test("buying YES raises the YES price, and costs exactly what was spent", () => {
  const shares = sharesForPoints(fresh, "yes", 50);
  assert.ok(shares > 50 && shares < 100, "50 points at 50¢–100¢ a share");
  const after = applyTrade(fresh, "yes", shares);
  assert.ok(probability(after) > 0.5);
  close(cost(after) - cost(fresh), 50);
});

test("buying NO lowers the YES price", () => {
  const after = applyTrade(fresh, "no", sharesForPoints(fresh, "no", 80));
  assert.ok(probability(after) < 0.5);
});

test("selling right after buying refunds the same points", () => {
  const shares = sharesForPoints(fresh, "no", 120);
  const after = applyTrade(fresh, "no", shares);
  close(pointsForShares(after, "no", shares), 120, 1e-6);
});

test("prices stay in (0, 1) and math stays finite for lopsided pools", () => {
  let pool = fresh;
  for (let i = 0; i < 10; i++) pool = applyTrade(pool, "yes", sharesForPoints(pool, "yes", 100));
  const p = probability(pool);
  assert.ok(p > 0.99 && p < 1);
  assert.ok(Number.isFinite(cost(pool)));
  assert.ok(Number.isFinite(sharesForPoints(pool, "no", 10)));
  assert.ok(sharesForPoints(pool, "no", 10) > 10, "cheap side gives more than a share per point");
});

test("zero, negative or NaN amounts trade nothing", () => {
  for (const v of [0, -5, Number.NaN]) {
    assert.equal(sharesForPoints(fresh, "yes", v), 0);
    assert.equal(pointsForShares(fresh, "yes", v), 0);
  }
});

test("the market maker's worst-case loss is b·ln 2", () => {
  // Someone buys YES up to ~100% and YES wins: payout - points taken in <= b ln 2.
  let pool = fresh, taken = 0;
  for (let i = 0; i < 40; i++) { const s = sharesForPoints(pool, "yes", 100); pool = applyTrade(pool, "yes", s); taken += 100; }
  assert.ok(pool.yes - taken <= 100 * Math.log(2) + 1e-6);
});
