// Server-only (Node APIs).
import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { request } from "node:https";
import { isIP } from "node:net";
import { extractOgImage, imageSourceFor, isPublicAddress, sniffImage, type ImageKind } from "@/lib/trend-image-rules";

// Fetches a trend entry's image once, when it's shared (issue #116, ADR 0043). SSRF rules:
// https only; every connection's address is checked at connect time (so DNS rebinding can't
// slip a private address in after a check); redirects are followed at most twice and re-checked;
// short timeouts and byte caps; no cookies or credentials are sent.

const TIMEOUT_MS = 4000;
const MAX_PAGE_BYTES = 600_000;
const MAX_JSON_BYTES = 50_000;
const MAX_IMAGE_BYTES = 2_000_000;
const MAX_REDIRECTS = 2;
const USER_AGENT = "MartletTrendImages/1.0 (+https://github.com/DongtaiHuang/Martlet)";

class FetchRefused extends Error {}

/** DNS lookup that refuses any non-public address, used for every connection. */
function safeLookup(hostname: string, options: object, callback: (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void) {
  dnsLookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const list = addresses as LookupAddress[];
    if (!list.length || !list.every((a) => isPublicAddress(a.address))) {
      return callback(Object.assign(new Error(`refused non-public address for ${hostname}`), { code: "EREFUSED" }), "");
    }
    const wantsAll = (options as { all?: boolean }).all;
    callback(null, wantsAll ? list : list[0].address, wantsAll ? undefined : list[0].family);
  });
}

function getOnce(url: URL, maxBytes: number, accept: string): Promise<{ status: number; location?: string; body: Buffer }> {
  return new Promise((resolve, reject) => {
    if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
      return reject(new FetchRefused("only plain https URLs"));
    }
    // Node skips the lookup for IP literals, so check those here.
    const literal = url.hostname.replace(/^\[|\]$/g, "");
    if (isIP(literal) && !isPublicAddress(literal)) return reject(new FetchRefused("non-public IP literal"));
    const req = request(url, {
      method: "GET",
      lookup: safeLookup as never,
      headers: { "user-agent": USER_AGENT, accept, "accept-encoding": "identity" },
      timeout: TIMEOUT_MS,
    }, (res) => {
      const status = res.statusCode ?? 0;
      if (status >= 300 && status < 400) {
        res.resume();
        return resolve({ status, location: res.headers.location, body: Buffer.alloc(0) });
      }
      const declared = Number(res.headers["content-length"] ?? 0);
      if (declared > maxBytes) { res.destroy(); return reject(new FetchRefused("too large")); }
      const chunks: Buffer[] = [];
      let size = 0;
      res.on("data", (chunk: Buffer) => {
        size += chunk.length;
        if (size > maxBytes) { res.destroy(); reject(new FetchRefused("too large")); return; }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({ status, body: Buffer.concat(chunks) }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new FetchRefused("timed out")));
    req.on("error", reject);
    // A hard overall deadline too, in case a server trickles bytes.
    setTimeout(() => req.destroy(new FetchRefused("deadline")), TIMEOUT_MS * 2).unref();
    req.end();
  });
}

/** GET with re-checked redirects (https, public addresses) and a byte cap. */
async function safeGet(start: string, maxBytes: number, accept: string): Promise<Buffer> {
  let url = new URL(start);
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await getOnce(url, maxBytes, accept);
    if (res.location !== undefined) {
      if (hop === MAX_REDIRECTS) throw new FetchRefused("too many redirects");
      url = new URL(res.location, url);
      continue;
    }
    if (res.status !== 200) throw new FetchRefused(`status ${res.status}`);
    return res.body;
  }
  throw new FetchRefused("too many redirects");
}

export type TrendImage = { bytes: Uint8Array } & ImageKind;

/** Finds and downloads the image for a shared entry. Null when the link isn't supported or anything fails. */
export async function fetchTrendImage(type: string, link: string): Promise<TrendImage | null> {
  const source = imageSourceFor(type, link);
  if (!source) return null;
  try {
    let imageUrl: string | null = null;
    if (source.kind === "spotify") {
      const json = JSON.parse((await safeGet(source.oembedUrl, MAX_JSON_BYTES, "application/json")).toString("utf8")) as { thumbnail_url?: unknown };
      imageUrl = typeof json.thumbnail_url === "string" ? json.thumbnail_url : null;
    } else {
      const html = (await safeGet(source.pageUrl, MAX_PAGE_BYTES, "text/html")).toString("utf8");
      imageUrl = extractOgImage(html, source.pageUrl);
    }
    if (!imageUrl) return null;
    const bytes = new Uint8Array(await safeGet(imageUrl, MAX_IMAGE_BYTES, "image/jpeg,image/png,image/webp"));
    const kind = sniffImage(bytes);
    return kind ? { bytes, ...kind } : null;
  } catch (error) {
    // Images are optional: the entry is shared without one.
    if (process.env.NODE_ENV === "development") console.warn("[trend-image] skipped:", error instanceof Error ? error.message : error);
    return null;
  }
}
