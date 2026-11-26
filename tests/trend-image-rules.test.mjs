import assert from "node:assert/strict";
import test from "node:test";
import { extractOgImage, imageSourceFor, isPublicAddress, sniffImage } from "../lib/trend-image-rules.ts";

test("isPublicAddress refuses loopback, private, link-local, metadata and other internal ranges", () => {
  for (const ip of [
    "127.0.0.1", "10.1.2.3", "172.16.0.1", "172.31.255.255", "192.168.1.1", "169.254.169.254", "100.64.0.1",
    "0.0.0.0", "224.0.0.1", "255.255.255.255", "198.18.0.1",
    "::1", "::", "fe80::1", "fc00::1", "fd12:3456::1", "::ffff:127.0.0.1", "::ffff:10.0.0.1", "::ffff:7f00:1",
    "64:ff9b::7f00:1", "2001:db8::1", "2002:7f00:1::1", "ff02::1",
    "localhost", "not-an-ip", "",
  ]) assert.equal(isPublicAddress(ip), false, ip);
  for (const ip of ["8.8.8.8", "151.101.1.69", "172.32.0.1", "2606:4700:4700::1111", "2a00:1450:4001::1", "::ffff:8.8.8.8"]) {
    assert.equal(isPublicAddress(ip), true, ip);
  }
});

test("imageSourceFor only accepts Spotify songs and recipe sites over plain https", () => {
  assert.deepEqual(imageSourceFor("song", "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc"), {
    kind: "spotify",
    oembedUrl: "https://open.spotify.com/oembed?url=https%3A%2F%2Fopen.spotify.com%2Ftrack%2F4uLU6hMCjMI75M1A2tKUQC",
  });
  assert.equal(imageSourceFor("song", "https://open.spotify.com/intl-fr/album/1ATL5GLyefJaxhQzSPVrLX")?.kind, "spotify");
  assert.deepEqual(imageSourceFor("recipe", "https://www.allrecipes.com/recipe/10813/cookies/#top"), {
    kind: "og-image", pageUrl: "https://www.allrecipes.com/recipe/10813/cookies/",
  });
  assert.equal(imageSourceFor("recipe", "https://cooking.nytimes.com/recipes/1015819")?.kind, "og-image");

  for (const [type, link] of [
    ["song", "http://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],           // not https
    ["song", "https://open.spotify.com.evil.com/track/4uLU6hMCjMI75M1A2tKUQC"],   // look-alike host
    ["song", "https://open.spotify.com/user/someone"],                            // not a track/album page
    ["song", "https://user:pw@open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"],    // credentials
    ["song", "https://open.spotify.com:8443/track/4uLU6hMCjMI75M1A2tKUQC"],       // odd port
    ["recipe", "https://notallrecipes.com/recipe/1"],                             // suffix trick
    ["recipe", "https://allrecipes.com.attacker.net/recipe/1"],
    ["recipe", "https://169.254.169.254/latest/meta-data"],
    ["coffee", "https://www.allrecipes.com/recipe/1"],                            // wrong type
    ["song", "not a url"],
  ]) assert.equal(imageSourceFor(type, link), null, `${type} ${link}`);
});

test("extractOgImage finds og:image in either attribute order and resolves relative URLs", () => {
  const page = "https://www.seriouseats.com/pasta";
  assert.equal(extractOgImage('<head><meta property="og:image" content="https://cdn.example.com/a.jpg?w=1&amp;h=2"></head>', page), "https://cdn.example.com/a.jpg?w=1&h=2");
  assert.equal(extractOgImage("<meta content='/img/pasta.webp' property='og:image' />", page), "https://www.seriouseats.com/img/pasta.webp");
  assert.equal(extractOgImage('<meta name="twitter:image" content="https://cdn.example.com/b.png">', page), "https://cdn.example.com/b.png");
  assert.equal(extractOgImage('<meta property="og:image" content="http://cdn.example.com/insecure.jpg">', page), null);
  assert.equal(extractOgImage('<meta property="og:title" content="Pasta">', page), null);
});

test("sniffImage trusts magic bytes, not names", () => {
  assert.deepEqual(sniffImage(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0])), { mime: "image/jpeg" });
  assert.deepEqual(sniffImage(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0])), { mime: "image/png" });
  assert.deepEqual(sniffImage(new TextEncoder().encode("RIFF\0\0\0\0WEBPVP8 ")), { mime: "image/webp" });
  assert.equal(sniffImage(new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'>")), null);
  assert.equal(sniffImage(new TextEncoder().encode("<html><body>")), null);
});
