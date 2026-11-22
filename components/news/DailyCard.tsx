import { Laugh, Quote } from "lucide-react";
import { dailyPicks } from "@/lib/daily";

/** Feed sidebar: today's quote and joke (same for everyone, flips at Montreal midnight). */
export function DailyCard() {
  const { quote, joke } = dailyPicks();
  return (
    <section aria-labelledby="daily-heading" className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm">
      <h2 id="daily-heading" className="eyebrow text-brand-ink">Today at McGill</h2>
      <figure className="mt-3">
        <Quote aria-hidden="true" size={18} className="text-brand-ink" />
        <blockquote className="mt-1 font-display text-lg leading-snug text-ink">{quote.text}</blockquote>
        <figcaption className="mt-1 text-sm text-ink-muted">— {quote.by}</figcaption>
      </figure>
      <div className="mt-4 border-t border-line-soft pt-3">
        <p className="flex items-start gap-2 text-sm font-semibold text-ink"><Laugh aria-hidden="true" size={17} className="mt-0.5 shrink-0 text-brand-ink" />{joke.setup}</p>
        {/* Native disclosure: works without JS, keyboard and screen-reader friendly. */}
        <details className="group mt-2">
          <summary className="inline-flex min-h-11 cursor-pointer list-none items-center rounded-lg px-2 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
            <span className="group-open:hidden">Tell me</span><span className="hidden group-open:inline">Ba-dum tss 🥁</span>
          </summary>
          <p className="mt-1 rounded-lg bg-surface-muted px-3 py-2 text-sm text-ink-2 motion-safe:animate-[martlet-fade-in_300ms_ease-out]">{joke.punch}</p>
        </details>
      </div>
    </section>
  );
}
