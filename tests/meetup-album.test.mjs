import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { ALBUM_DAYS, albumClosesAt, albumState, timeLeft } from "../lib/meetup-album.ts";
import { crc32, makeZip } from "../lib/zip.ts";

const DAY = 86_400_000;
const start = "2026-11-20T18:00:00.000Z";
const t = Date.parse(start);

test("album opens at the start and closes ALBUM_DAYS later", () => {
  assert.equal(albumClosesAt(start), t + ALBUM_DAYS * DAY);
  assert.equal(albumState({ starts_at: start, status: "open" }, t - 1), "not-started");
  assert.equal(albumState({ starts_at: start, status: "open" }, t), "open");
  assert.equal(albumState({ starts_at: start, status: "open" }, t + ALBUM_DAYS * DAY - 1), "open");
  assert.equal(albumState({ starts_at: start, status: "open" }, t + ALBUM_DAYS * DAY), "closed");
  assert.equal(albumState({ starts_at: start, status: "cancelled" }, t + 1000), "closed");
});

test("timeLeft picks a readable unit", () => {
  assert.equal(timeLeft(t + 3 * DAY + 5, t), "in 3 days");
  assert.equal(timeLeft(t + 30 * 3_600_000, t), "in 30 hours");
  assert.equal(timeLeft(t + 61_000, t), "in 2 minutes");
  assert.equal(timeLeft(t - 5, t), "in 1 minute");
});

test("crc32 matches the standard check value", () => {
  assert.equal(crc32(new TextEncoder().encode("123456789")), 0xcbf43926);
});

test("makeZip produces an archive unzip can read", (t) => {
  const files = [
    { name: "photo-1.jpg", data: new Uint8Array([0xff, 0xd8, 0xff, 1, 2, 3]) },
    { name: "photo-2.jpg", data: new TextEncoder().encode("hello martlet") },
  ];
  const zip = makeZip(files);
  const dir = mkdtempSync(join(tmpdir(), "martlet-zip-"));
  const path = join(dir, "album.zip");
  writeFileSync(path, zip);
  let listing;
  try { listing = execFileSync("unzip", ["-t", path], { encoding: "utf8" }); }
  catch (error) {
    if (error.code === "ENOENT") return t.skip("unzip not installed");
    throw error;
  }
  assert.match(listing, /No errors detected/);
  const text = execFileSync("unzip", ["-p", path, "photo-2.jpg"], { encoding: "utf8" });
  assert.equal(text, "hello martlet");
});
