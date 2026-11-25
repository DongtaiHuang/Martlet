import assert from "node:assert/strict";
import test from "node:test";
import { coinsForPoints, fillPrice, formatCoins, pointsForCoins } from "../lib/martlet-coin-types.ts";

test("fills include the 0.5% spread, rounded like the SQL", () => {
  assert.equal(fillPrice(10, "buy"), 10.05);
  assert.equal(fillPrice(10, "sell"), 9.95);
  assert.equal(fillPrice(12.3456, "buy"), 12.4073); // round(12.3456 * 1.005, 4)
});

test("coins for points truncate to 6 decimals; sales floor to whole points", () => {
  assert.equal(coinsForPoints(100, 10), 9.950248);
  assert.equal(pointsForCoins(9.950248, 10), 99); // a round trip loses the spread
  assert.equal(pointsForCoins(0.05, 10), 0);
});

test("coin formatting", () => {
  assert.equal(formatCoins(123.456), "123.45");
  assert.equal(formatCoins(9.950248), "9.9502");
  assert.equal(formatCoins(0.0123456), "0.012345");
});
