"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, Lightbulb, Search } from "lucide-react";
import { GUIDES, TIPS } from "@/lib/guides";

/** Searchable how-to guides (numbered steps, WikiHow style) and quick tips. */
export function GuideBrowser() {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();
  const guides = useMemo(() => GUIDES.filter((g) => !query || [g.title, g.summary, ...g.tags, ...g.steps.flatMap((s) => [s.title, s.body])].join(" ").toLowerCase().includes(query)), [query]);
  const tips = useMemo(() => TIPS.filter((t) => !query || `${t.tip} ${t.tag}`.toLowerCase().includes(query)), [query]);

  return (
    <>
      <label className="mt-6 flex min-h-12 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 focus-within:outline-2 focus-within:outline-focus">
        <Search aria-hidden="true" size={18} className="text-ink-subtle" />
        <span className="sr-only">Search guides and tips</span>
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search: Minerva, winter, study rooms…" className="min-w-0 flex-1 bg-transparent py-2 text-ink outline-none placeholder:text-ink-subtle" />
      </label>
      <p role="status" className="sr-only">{guides.length} guides and {tips.length} tips</p>

      <section aria-labelledby="howto-heading" className="mt-8">
        <h2 id="howto-heading" className="text-2xl font-bold">How-to guides</h2>
        {guides.length === 0 && <p className="mt-2 text-sm text-ink-muted">No guides match “{q}”.</p>}
        <div className="mt-4 grid gap-3">
          {guides.map((g) => (
            <details key={g.id} id={g.id} className="group rounded-2xl border border-line bg-surface shadow-sm open:shadow-md" open={Boolean(query)}>
              <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 rounded-2xl p-4 hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus [&::-webkit-details-marker]:hidden">
                <span aria-hidden="true" className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-2xl">{g.emoji}</span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold leading-snug text-ink">{g.title}</span>
                  <span className="block text-sm text-ink-muted">{g.summary}</span>
                </span>
                <span aria-hidden="true" className="text-xl text-ink-subtle transition-transform group-open:rotate-45">+</span>
              </summary>
              <ol className="grid gap-3 px-4 pb-4 sm:grid-cols-2">
                {g.steps.map((s, i) => (
                  <li key={s.title} className="rounded-xl bg-surface-muted p-4">
                    <p className="eyebrow text-brand-ink">Step {i + 1}</p>
                    <p className="mt-1 font-semibold text-ink">{s.title}</p>
                    <p className="mt-1 text-sm leading-6 text-ink-2">{s.body}</p>
                  </li>
                ))}
              </ol>
              {g.link && (
                <a href={g.link.href} target="_blank" rel="noopener noreferrer" className="mx-4 mb-4 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-ink hover:underline">
                  {g.link.label} <ArrowUpRight aria-hidden="true" size={14} /><span className="sr-only"> (official McGill or partner site)</span>
                </a>
              )}
            </details>
          ))}
        </div>
      </section>

      <section aria-labelledby="tips-heading" className="mt-10">
        <h2 id="tips-heading" className="flex items-center gap-2 text-2xl font-bold"><Lightbulb aria-hidden="true" size={22} className="text-brand-ink" /> Quick tips</h2>
        {tips.length === 0 && <p className="mt-2 text-sm text-ink-muted">No tips match “{q}”.</p>}
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {tips.map((t) => (
            <li key={t.tip} className="rounded-xl border border-line bg-surface p-4">
              <p className="eyebrow text-ink-muted">{t.tag}</p>
              <p className="mt-1 text-ink-2">{t.tip}</p>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
