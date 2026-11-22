import assert from "node:assert/strict";
import test from "node:test";
import { futureLocalTimeToUtc, nextLocalMinute } from "../lib/local-date-time.ts";
import { pollFailureCategory } from "../lib/poll-diagnostics.ts";

process.env.TZ = "America/Toronto";

test("current minute, earlier today and yesterday are rejected; future choices convert once", () => {
  const now = Date.parse("2026-01-15T19:30:05Z");
  assert.equal(futureLocalTimeToUtc("2026-01-14T14:30", now), "");
  assert.equal(futureLocalTimeToUtc("2026-01-15T14:15", now), "");
  assert.equal(futureLocalTimeToUtc("2026-01-15T14:30", now), "");
  assert.equal(futureLocalTimeToUtc("2026-01-15T14:31", now), "2026-01-15T19:31:00.000Z");
  assert.equal(futureLocalTimeToUtc("2026-01-16T10:00", now), "2026-01-16T15:00:00.000Z");
});

test("advances at minute boundaries and rejects a stale selection", () => {
  const now = Date.parse("2026-01-15T19:30:59Z");
  assert.equal(nextLocalMinute(now), "2026-01-15T14:31");
  assert.equal(nextLocalMinute(now + 1000), "2026-01-15T14:32");
  assert.equal(futureLocalTimeToUtc("2026-01-15T14:31", now + 1000), "");
  assert.equal(nextLocalMinute(Date.parse("2026-01-16T04:59:59Z")), "2026-01-16T00:00");
});

test("skips spring-forward gaps and avoids selecting a past occurrence in the autumn fold", () => {
  assert.equal(nextLocalMinute(Date.parse("2026-03-08T06:59:59Z")), "2026-03-08T03:00");
  assert.equal(futureLocalTimeToUtc("2026-03-08T02:30", Date.parse("2026-03-08T06:00Z")), "");
  assert.equal(nextLocalMinute(Date.parse("2026-11-01T06:15:00Z")), "2026-11-01T02:00");
});

test("distinguishes unavailable schema, RPC, permission and transport failures", () => {
  assert.equal(pollFailureCategory("PGRST205"), "poll-table-missing");
  assert.equal(pollFailureCategory("PGRST202"), "poll-rpc-missing-or-stale-cache");
  assert.equal(pollFailureCategory("42501"), "permission-denied-or-expired-session");
  assert.equal(pollFailureCategory(""), "database-or-network-error");
});