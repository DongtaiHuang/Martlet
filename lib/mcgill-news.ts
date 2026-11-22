// McGill News (https://mcgillnews.mcgill.ca), read from its public RSS feed on the server and
// cached for an hour. We show headlines, a short excerpt and the lead image, and always link
// to the original article rather than republishing it.

const FEED_URL = "https://mcgillnews.mcgill.ca/feed/";
const SITE = "https://mcgillnews.mcgill.ca";

export type NewsItem = {
  title: string;
  url: string;
  publishedAt: string | null;
  author: string | null;
  categories: string[];
  excerpt: string;
  image: string | null;
};

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": "\"", "&#039;": "'", "&#8217;": "’", "&#8216;": "‘", "&#8220;": "“", "&#8221;": "”", "&#8211;": "–", "&#8212;": "—", "&nbsp;": " ", "&#8230;": "…" };

function decode(text: string): string {
  return text
    .replace(/&#(\d+);/g, (m, n) => ENTITIES[m] ?? String.fromCodePoint(Number(n)))
    .replace(/&[a-z]+;/gi, (m) => ENTITIES[m] ?? m);
}

function cdata(text: string): string {
  return text.replace(/^\s*<!\[CDATA\[/, "").replace(/\]\]>\s*$/, "");
}

function tag(item: string, name: string): string | null {
  const m = item.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return m ? cdata(m[1]).trim() : null;
}

function stripHtml(html: string): string {
  return decode(html.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

/** Only https links to McGill News itself (or its image CDN on the same host). */
function safeUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(decode(value), SITE);
    return url.protocol === "https:" && url.hostname.endsWith("mcgill.ca") ? url.toString() : null;
  } catch {
    return null;
  }
}

export function parseFeed(xml: string): NewsItem[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  const out: NewsItem[] = [];
  for (const item of items) {
    const title = tag(item, "title");
    const url = safeUrl(tag(item, "link"));
    if (!title || !url) continue;
    const description = (tag(item, "description") ?? "").replace(/<p>The post [\s\S]*$/i, "");
    const content = tag(item, "content:encoded") ?? "";
    const image = safeUrl(content.match(/<img[^>]+src="([^"]+)"/i)?.[1]);
    const excerpt = stripHtml(description || content);
    const date = tag(item, "pubDate");
    out.push({
      title: stripHtml(title),
      url,
      publishedAt: date && !Number.isNaN(Date.parse(date)) ? new Date(date).toISOString() : null,
      author: tag(item, "dc:creator") ? stripHtml(tag(item, "dc:creator")!) : null,
      categories: [...item.matchAll(/<category>([\s\S]*?)<\/category>/g)].map((m) => stripHtml(cdata(m[1]))).filter(Boolean).slice(0, 3),
      excerpt: excerpt.length > 260 ? `${excerpt.slice(0, 257).trimEnd()}…` : excerpt,
      image,
    });
  }
  return out;
}

/** The article's own share image (og:image), for stories whose feed entry has none. Cached a day. */
async function shareImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { next: { revalidate: 86400 }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) return null;
    const head = (await res.text()).slice(0, 60_000);
    return safeUrl(head.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1]
      ?? head.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1]);
  } catch {
    return null;
  }
}

/** Latest McGill News stories, or null if the feed can't be reached (callers show a fallback link). */
export async function getMcGillNews(limit = 10, { images = false } = {}): Promise<NewsItem[] | null> {
  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 3600 }, headers: { accept: "application/rss+xml" }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return null;
    const items = parseFeed(await res.text()).slice(0, limit);
    if (!images) return items;
    return Promise.all(items.map(async (n) => (n.image ? n : { ...n, image: await shareImage(n.url) })));
  } catch (error) {
    console.warn("McGill News feed unavailable", error);
    return null;
  }
}

export const MCGILL_NEWS_URL = SITE;
