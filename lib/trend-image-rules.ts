import { isIP } from "node:net";

// Rules for trend images (issue #116, ADR 0043). Pure and dependency-free so node --test can
// import it; the network code that uses them is lib/trend-image-fetch.ts.

/** Song pages we read album art from, through Spotify's public oEmbed endpoint (no API key). */
const SPOTIFY_PATH = /^\/(intl-[a-z-]+\/)?(track|album|playlist|episode|show)\/[A-Za-z0-9]{10,40}\/?$/;

/** Recipe sites whose pages we read an og:image from. Subdomains (www., cooking.) count. */
export const RECIPE_HOSTS = [
  "allrecipes.com", "bbcgoodfood.com", "bonappetit.com", "budgetbytes.com", "cooking.nytimes.com",
  "epicurious.com", "food52.com", "foodnetwork.com", "minimalistbaker.com", "recipetineats.com",
  "ricardocuisine.com", "seriouseats.com", "simplyrecipes.com", "tasty.co", "thekitchn.com",
] as const;

export type ImageSource = { kind: "spotify"; oembedUrl: string } | { kind: "og-image"; pageUrl: string };

const hostMatches = (host: string, domain: string) => host === domain || host.endsWith(`.${domain}`);

/** Where to look for an image for this entry, or null when the link isn't from a supported site. */
export function imageSourceFor(type: string, link: string): ImageSource | null {
  let url: URL;
  try { url = new URL(link); } catch { return null; }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return null;
  const host = url.hostname.toLowerCase();
  if (type === "song" && host === "open.spotify.com" && SPOTIFY_PATH.test(url.pathname)) {
    const clean = `https://open.spotify.com${url.pathname}`;
    return { kind: "spotify", oembedUrl: `https://open.spotify.com/oembed?url=${encodeURIComponent(clean)}` };
  }
  if (type === "recipe" && RECIPE_HOSTS.some((d) => hostMatches(host, d))) {
    return { kind: "og-image", pageUrl: `https://${host}${url.pathname}${url.search}` };
  }
  return null;
}

/** The og:image (or twitter:image) URL in a page's HTML, resolved against the page, https only. */
export function extractOgImage(html: string, pageUrl: string): string | null {
  const head = html.slice(0, 200_000);
  for (const tag of head.match(/<meta\b[^>]*>/gi) ?? []) {
    const attr = (name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, "i"))?.slice(1).find((v) => v !== undefined);
    const key = (attr("property") ?? attr("name") ?? "").toLowerCase();
    if (!["og:image", "og:image:secure_url", "twitter:image"].includes(key)) continue;
    const content = attr("content")?.trim().replace(/&amp;/g, "&");
    if (!content) continue;
    try {
      const resolved = new URL(content, pageUrl);
      if (resolved.protocol === "https:") return resolved.toString();
    } catch { /* try the next tag */ }
  }
  return null;
}

function ipv4Public(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  if (a === 0 || a === 10 || a === 127) return false;            // this network, private, loopback
  if (a === 100 && b >= 64 && b <= 127) return false;              // carrier-grade NAT
  if (a === 169 && b === 254) return false;                        // link-local (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return false;               // private
  if (a === 192 && (b === 168 || b === 0)) return false;           // private, IETF protocol assignments
  if (a === 198 && (b === 18 || b === 19)) return false;           // benchmarking
  if (a >= 224) return false;                                      // multicast, reserved, broadcast
  return true;
}

/** True only for globally routable unicast addresses: never loopback, private, link-local or metadata. */
export function isPublicAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return ipv4Public(ip);
  if (family !== 6) return false;
  const v6 = ip.toLowerCase();
  const mapped = v6.match(/^(?:0*:)*:?ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return ipv4Public(mapped[1]);
  if (v6 === "::" || v6 === "::1") return false;
  // Global unicast is 2000::/3; everything else (ULA fc00::/7, link-local fe80::/10, multicast,
  // NAT64 and other transition ranges) is refused.
  if (!/^[23][0-9a-f]{0,3}:/.test(v6)) return false;
  if (v6.startsWith("2001:db8:") || v6.startsWith("2002:")) return false;
  return true;
}

export type ImageKind = { mime: "image/jpeg" | "image/png" | "image/webp" };

/** Recognises JPEG, PNG and WebP by their first bytes (never trusts the server's content type). */
export function sniffImage(bytes: Uint8Array): ImageKind | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return { mime: "image/jpeg" };
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return { mime: "image/png" };
  const ascii = (from: number, to: number) => String.fromCharCode(...bytes.slice(from, to));
  if (ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") return { mime: "image/webp" };
  return null;
}
