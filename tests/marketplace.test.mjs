import assert from "node:assert/strict";
import test from "node:test";
import { formatPrice, parsePrice } from "../lib/marketplace-catalog.ts";

test("parsePrice accepts dollars and cents, rejects junk and huge prices", () => {
  assert.equal(parsePrice(""), null);
  assert.equal(parsePrice("12"), 1200);
  assert.equal(parsePrice("$12.5"), 1250);
  assert.equal(parsePrice("1,000"), 100000);
  assert.ok(Number.isNaN(parsePrice("1000.01")));
  assert.ok(Number.isNaN(parsePrice("12.345")));
  assert.ok(Number.isNaN(parsePrice("-3")));
  assert.ok(Number.isNaN(parsePrice("ten")));
});

test("formatPrice reads naturally for every kind", () => {
  assert.equal(formatPrice(null, "free"), "Free");
  assert.equal(formatPrice(null, "swap"), "Swap");
  assert.equal(formatPrice(null, "wanted"), "Any budget");
  assert.equal(formatPrice(4500, "sell"), "$45");
  assert.equal(formatPrice(4550, "sell"), "$45.50");
});
