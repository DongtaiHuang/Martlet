import assert from "node:assert/strict";
import test from "node:test";
import { formatBudget, isCreatorLink, linkLabel, parseLinks } from "../lib/creator-catalog.ts";

test("isCreatorLink accepts https links only", () => {
  assert.ok(isCreatorLink("https://soundcloud.com/someone"));
  assert.ok(!isCreatorLink("http://example.com"));
  assert.ok(!isCreatorLink("javascript:alert(1)"));
  assert.ok(!isCreatorLink("https://has space.com"));
  assert.ok(!isCreatorLink("https://"));
  assert.ok(!isCreatorLink(`https://${"a".repeat(300)}.com`));
});

test("parseLinks reads one link per line, dedupes, and rejects bad or too many links", () => {
  assert.deepEqual(parseLinks(""), []);
  assert.deepEqual(parseLinks(" https://a.com/x \n\nhttps://b.com\r\nhttps://a.com/x"), ["https://a.com/x", "https://b.com"]);
  assert.equal(parseLinks("https://a.com\nwww.b.com"), null);
  assert.equal(parseLinks(Array.from({ length: 6 }, (_, i) => `https://a.com/${i}`).join("\n")), null);
});

test("linkLabel shows the host without www", () => {
  assert.equal(linkLabel("https://www.behance.net/someone"), "behance.net");
  assert.equal(linkLabel("https://github.com/someone/repo"), "github.com");
  assert.equal(linkLabel("not a url"), "not a url");
});

test("formatBudget reads naturally", () => {
  assert.equal(formatBudget(null), "Open budget");
  assert.equal(formatBudget(8000), "$80");
  assert.equal(formatBudget(1250), "$12.50");
});
