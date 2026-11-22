import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { getMcGillNews, MCGILL_NEWS_URL } from "@/lib/mcgill-news";
import { NewsList } from "./NewsList";

/** Feed sidebar: three latest McGill News headlines, with a link to the full /news page. */
export async function NewsPreview() {
  const items = await getMcGillNews(3);
  return (
    <section aria-labelledby="news-preview-heading" className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="news-preview-heading" className="flex items-center gap-2 text-lg font-bold text-ink"><Newspaper aria-hidden="true" size={18} className="text-brand-ink" />McGill News</h2>
        <Link href="/news" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-ink hover:underline">All stories <ArrowRight aria-hidden="true" size={14} /></Link>
      </div>
      {items && items.length > 0
        ? <NewsList items={items} compact />
        : <p className="mt-2 text-sm text-ink-muted">Couldn’t reach McGill News right now. <a href={MCGILL_NEWS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-ink underline">Read it on mcgillnews.mcgill.ca</a>.</p>}
    </section>
  );
}
