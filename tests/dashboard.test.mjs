import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LAYOUT, moveWidget, parseLayout, serializeLayout, toggleWidget, visibleWidgets, WIDGETS } from "../lib/dashboard.ts";

test("default layout when there is no or a bad cookie", () => {
  for (const raw of [undefined, null, "", "x".repeat(201)]) assert.deepEqual(parseLayout(raw), DEFAULT_LAYOUT);
});

test("round-trips order, hidden widgets and the carousel", () => {
  const layout = { order: ["news", "trends", "flight", "daily"], hidden: ["flight"], hero: false };
  const raw = serializeLayout(layout);
  assert.equal(raw, "h0.news.trends.-flight.daily");
  assert.match(raw, /^[a-z0-9.-]+$/);
  assert.deepEqual(parseLayout(raw), layout);
});

test("unknown and repeated ids are dropped; missing widgets are appended", () => {
  assert.deepEqual(parseLayout("h1.news.<script>.news.-ads.daily"), { order: ["news", "daily", "trends", "flight"], hidden: [], hero: true });
  assert.deepEqual(parseLayout("flight").order, ["flight", "trends", "daily", "news"]);
});

test("moving and hiding", () => {
  let layout = moveWidget(DEFAULT_LAYOUT, "flight", 0);
  assert.deepEqual(layout.order, ["flight", "trends", "daily", "news"]);
  layout = moveWidget(layout, "flight", 99);
  assert.deepEqual(layout.order, [...WIDGETS]);
  layout = toggleWidget(layout, "news");
  assert.deepEqual(visibleWidgets(layout), ["trends", "daily", "flight"]);
  assert.deepEqual(toggleWidget(layout, "news").hidden, []);
  assert.deepEqual(DEFAULT_LAYOUT.order, [...WIDGETS], "default not mutated");
});
