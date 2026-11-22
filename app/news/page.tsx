import type { Metadata } from "next";
import { MartletNav } from "@/components/layout/MartletNav";
import { NewsList } from "@/components/news/NewsList";
import { getMcGillNews, MCGILL_NEWS_URL } from "@/lib/mcgill-news";

export const metadata: Metadata = { title: "McGill News · McGill Martlet" };
export const revalidate = 3600;

export default async function NewsPage() {
  const items = await getMcGillNews(12, { images: true });
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">McGill News</h1>
        <p className="mt-2 text-ink-muted">
          The latest stories from <a href={MCGILL_NEWS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-ink underline">McGill News</a>, the University’s magazine. Updated hourly; every story opens on their site.
        </p>
        {items && items.length > 0 ? (
          <NewsList items={items} />
        ) : (
          <p role="status" className="mt-6 rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
            Couldn’t reach McGill News right now. <a href={MCGILL_NEWS_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-ink underline">Open mcgillnews.mcgill.ca</a>.
          </p>
        )}
      </main>
    </div>
  );
}
