import Link from "next/link";
import type { ComponentType } from "react";
import { BookOpen, ChefHat, Coffee, ExternalLink, Flame, LogIn, MapPin, Music } from "lucide-react";
import type { FeedView } from "@/components/feed/FeedViewToggle";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { listTrends } from "@/lib/trends";
import type { TrendEntry, TrendType } from "@/types/trend";
import { TrendAddForm } from "./TrendAddForm";
import { TrendLikeButton } from "./TrendLikeButton";

const TYPE_META: Record<TrendType, {
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  chip: string;
}> = {
  coffee: { label: "Coffee", icon: Coffee, chip: "bg-amber-100 text-amber-950 ring-1 ring-amber-200" },
  study: { label: "Study", icon: BookOpen, chip: "bg-sky-100 text-sky-950 ring-1 ring-sky-200" },
  recipe: { label: "Recipe", icon: ChefHat, chip: "bg-lime-100 text-lime-950 ring-1 ring-lime-200" },
  song: { label: "Song", icon: Music, chip: "bg-violet-100 text-violet-950 ring-1 ring-violet-200" },
};

const TABS: { key: TrendType | null; label: string }[] = [
  { key: null, label: "All" },
  { key: "coffee", label: "Coffee" },
  { key: "study", label: "Study" },
  { key: "recipe", label: "Recipe" },
  { key: "song", label: "Song" },
];

export function TrendPanelLoading() {
  return (
    <div className="rounded-2xl border border-line bg-surface p-5">
      <p role="status" className="text-sm text-ink-muted">Loading trends…</p>
      <div aria-hidden="true" className="mt-4 space-y-3 motion-safe:animate-pulse">
        {[1, 2, 3].map((row) => <div key={row} className="h-14 rounded-xl bg-surface-muted" />)}
      </div>
    </div>
  );
}

export async function TrendPanel({ view, activeType }: { view: FeedView; activeType: TrendType | null }) {
  const live = getDataMode() === "live";
  const viewer = live ? await getCurrentUser().catch(() => null) : null;

  let entries: TrendEntry[] | null = null;
  // Live mode: trends are only readable when signed in (RLS), so don't show an empty panel.
  if (!live || viewer) {
    try {
      entries = await listTrends(activeType ?? undefined, 10);
    } catch (error) {
      console.error("Failed to load trends for the side panel", error);
    }
  }

  const tabHref = (type: TrendType | null) => `/meetups?view=${view}${type ? `&trend=${type}` : ""}`;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <h2 id="trend-heading" className="flex items-center gap-2 text-lg font-extrabold tracking-tight">
        <Flame aria-hidden="true" size={18} className="text-brand-ink" /> Trending on campus
      </h2>
      <p className="mt-1 text-sm text-ink-muted">Most liked rises to the top.</p>

      <nav aria-label="Trend categories" className="mt-3 flex flex-wrap gap-1.5">
        {TABS.map((tab) => (
          <Link
            key={tab.label}
            href={tabHref(tab.key)}
            aria-current={activeType === tab.key ? "page" : undefined}
            className={`inline-flex min-h-9 items-center rounded-full px-3 text-xs font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${
              activeType === tab.key
                ? "bg-brand text-on-brand"
                : "border border-line-strong text-ink-soft hover:border-brand hover:text-brand-ink"
            }`}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {!live && (
        <p className="mt-3 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-xs text-warn-ink">
          <strong>Preview:</strong> sample trends, not real shares. Liking needs Supabase. See <code>docs/SUPABASE_SETUP.md</code>.
        </p>
      )}
      {live && !viewer && (
        <div className="mt-3 rounded-xl border border-line px-4 py-6 text-center">
          <LogIn aria-hidden="true" className="mx-auto mb-2 text-brand-ink" />
          <p className="text-sm font-semibold text-ink-soft">Sign in to like and rank trends</p>
          <Link
            href={`/login?next=${encodeURIComponent(`/meetups?view=${view}`)}`}
            className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          >
            Sign in
          </Link>
        </div>
      )}
      {live && viewer && entries === null && (
        <p className="mt-3 rounded-xl border border-line bg-canvas px-4 py-6 text-center text-sm text-ink-muted">
          Couldn’t load trends right now. Refresh to retry.
        </p>
      )}
      {entries && (
        <>
          {entries.length === 0 ? (
            <p className="mt-3 rounded-xl border border-dashed border-line-strong bg-canvas px-4 py-8 text-center text-sm text-ink-muted">
              Nothing here yet{activeType ? ` in ${TYPE_META[activeType].label.toLowerCase()}` : ""}. Be the first to share something.
            </p>
          ) : (
            <ol className="mt-3 space-y-2">
              {entries.map((entry, index) => {
                const meta = TYPE_META[entry.type];
                const Icon = meta.icon;
                return (
                  <li key={entry.id} className="rounded-xl border border-line bg-canvas p-3">
                    <div className="flex items-start gap-2">
                      <span aria-hidden="true" className="mt-0.5 w-5 shrink-0 text-right text-sm font-extrabold tabular-nums text-ink-muted">{index + 1}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold [overflow-wrap:anywhere]">{entry.title}</p>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>
                            <Icon aria-hidden size={12} /> {meta.label}
                          </span>
                          {entry.campusLocation && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-ink-muted">
                              <MapPin aria-hidden="true" size={12} /> {entry.campusLocation.name}
                            </span>
                          )}
                          {entry.link && (
                            <a
                              href={entry.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-[11px] font-semibold text-brand-ink underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                            >
                              Listen <ExternalLink aria-hidden="true" size={11} />
                            </a>
                          )}
                        </div>
                        {entry.detail && <p className="mt-1 line-clamp-2 text-xs leading-5 text-ink-muted">{entry.detail}</p>}
                      </div>
                    </div>
                    <div className="mt-2 pl-7">
                      <TrendLikeButton entryId={entry.id} active={entry.likedByMe} count={entry.likeCount} disabled={!live || !viewer} />
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
          {live && viewer && <TrendAddForm />}
        </>
      )}
    </section>
  );
}
