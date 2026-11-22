import { ArrowUpRight } from "lucide-react";
import type { NewsItem } from "@/lib/mcgill-news";

const date = (iso: string | null) => (iso ? new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" }).format(new Date(iso)) : null);

/** Headlines linking out to McGill News. `compact` = feed preview (no images or excerpts). */
export function NewsList({ items, compact = false }: { items: NewsItem[]; compact?: boolean }) {
  return (
    <ul className={compact ? "mt-2 divide-y divide-line-soft" : "mt-6 grid gap-5 sm:grid-cols-2"}>
      {items.map((n) => (
        <li key={n.url} className={compact ? "py-2.5" : "overflow-hidden rounded-2xl border border-line bg-surface shadow-sm"}>
          <a href={n.url} target="_blank" rel="noopener noreferrer" className="group block focus-visible:outline-2 focus-visible:outline-focus">
            {!compact && (n.image ? (
              // eslint-disable-next-line @next/next/no-img-element -- remote McGill image, shown as-is
              <img src={n.image} alt="" loading="lazy" className="aspect-[16/9] w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
            ) : <div aria-hidden="true" className="grid aspect-[16/9] w-full place-items-center bg-gradient-to-br from-brand-soft to-surface-muted font-display text-2xl text-brand-ink/60">McGill News</div>)}
            <div className={compact ? "" : "p-4"}>
              {(n.categories[0] || n.publishedAt) && (
                <p className="eyebrow text-ink-muted">{[n.categories[0], date(n.publishedAt)].filter(Boolean).join(" · ")}</p>
              )}
              <h3 className={`${compact ? "mt-0.5 text-sm" : "mt-1 text-lg"} font-semibold leading-snug text-ink group-hover:underline`}>
                {n.title} <ArrowUpRight aria-hidden="true" size={14} className="inline text-ink-subtle" /><span className="sr-only"> (opens McGill News)</span>
              </h3>
              {!compact && n.excerpt && <p className="mt-1.5 line-clamp-3 text-sm leading-6 text-ink-2">{n.excerpt}</p>}
            </div>
          </a>
        </li>
      ))}
    </ul>
  );
}
