import assert from "node:assert/strict";
import test from "node:test";
import { safeRedirectPath } from "../lib/supabase/redirect.ts";

test("post-auth redirects preserve same-site destinations", () => {
  assert.equal(safeRedirectPath("/explore?meetup=example"), "/explore?meetup=example");
  assert.equal(safeRedirectPath(null), "/meetups");
});

test("post-auth redirects reject absolute URLs and malformed relative paths", () => {
  for (const value of ["https://example.org", "//example.org", "/\\example.org", "/\t/example.org"]) {
    assert.equal(safeRedirectPath(value), "/meetups");
  }
});
