import type { Metadata } from "next";
import Link from "next/link";
import { CircleCheck, CircleSlash, Coins, FlaskConical, Plus, ShieldCheck, TrendingUp, Trophy } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { closesLabel } from "@/components/markets/format";
import { getBalance, getMarketLeaderboard, isMarketModerator, isPreview, listMarkets, listMyProposals, type Market } from "@/lib/markets";

export const metadata: Metadata = { title: "Predictions · McGill Martlet" };
export const dynamic = "force-dynamic";

const chip = (on: boolean) => `inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${on ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink-2 hover:border-brand"}`;

function MarketCard({ market, now }: { market: Market; now: number }) {
  const settled = market.status === "resolved" || market.status === "cancelled";
  const p = Math.round(market.probability * 100);
  return (
    <li className="relative rounded-2xl border border-line bg-surface p-4 shadow-sm transition hover:border-line-strong sm:p-5">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold leading-snug text-ink [overflow-wrap:anywhere] sm:text-lg">
            <Link href={`/markets/${market.id}`} className="after:absolute after:inset-0 hover:underline focus-visible:outline-2 focus-visible:outline-focus">{market.question}</Link>
          </h2>
          <p className="mt-1 text-xs text-ink-muted">
            {settled ? (market.status === "cancelled" ? "Cancelled" : `Resolved ${market.outcome === "yes" ? "Yes" : "No"}`) : closesLabel(market.closes_at, now)}
            {" · "}{market.volume.toLocaleString("en-CA")} points traded
          </p>
        </div>
        <div className="shrink-0 text-right">
          {settled ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-muted px-2.5 py-1 text-sm font-bold text-ink">
              {market.status === "cancelled" ? <CircleSlash aria-hidden="true" size={15} /> : <CircleCheck aria-hidden="true" size={15} />}
              {market.status === "cancelled" ? "Refunded" : market.outcome === "yes" ? "Yes" : "No"}
            </span>
          ) : (
            <>
              <p className="text-2xl font-extrabold tabular-nums text-ink">{p}%</p>
              <p className="text-xs text-ink-muted">chance of yes</p>
            </>
          )}
        </div>
      </div>
      {!settled && (
        <div aria-hidden="true" className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-muted">
          <div className="h-full rounded-full bg-brand-ink" style={{ width: `${p}%` }} />
        </div>
      )}
    </li>
  );
}

function loadNow() {
  return Date.now();
}

export default async function MarketsPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view: viewParam } = await searchParams;
  const view = viewParam === "settled" ? "settled" : "open";
  const [markets, balance, leaderboard, moderator, proposals] = await Promise.all([
    listMarkets(view), getBalance(), getMarketLeaderboard(5), isMarketModerator(), listMyProposals(),
  ]);
  const now = loadNow();
  const preview = isPreview();

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-xl">
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Predictions</h1>
            <p className="mt-2 text-ink-muted">Forecast campus events with Martlet points. It’s a game: points have no cash value and can’t be bought or cashed out.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {balance !== null && (
              <p className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line bg-surface px-3 text-sm font-bold text-ink">
                <Coins aria-hidden="true" size={16} className="text-amber-600 dark:text-amber-300" />{balance.toLocaleString("en-CA")}<span className="font-semibold text-ink-muted">points</span>
              </p>
            )}
            {moderator && <Link href="/markets/review" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-bold text-ink-2 hover:border-brand focus-visible:outline-2 focus-visible:outline-focus"><ShieldCheck aria-hidden="true" size={16} /> Review</Link>}
            <Link href="/markets/new" className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"><Plus aria-hidden="true" size={16} /> Propose a market</Link>
          </div>
        </div>

        {preview && (
          <p className="mt-5 flex flex-wrap items-center gap-1.5 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            <FlaskConical aria-hidden="true" size={15} />
            <span><strong>Preview:</strong> sample markets, not real forecasts. Trading needs Supabase. See <code>docs/SUPABASE_SETUP.md</code>.</span>
          </p>
        )}

        <div className="mt-6 gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_300px]">
          <section aria-labelledby="markets-heading">
            <h2 id="markets-heading" className="sr-only">{view === "open" ? "Open markets" : "Settled markets"}</h2>
            <nav aria-label="Market status" className="flex gap-2">
              <Link href="/markets" aria-current={view === "open" ? "page" : undefined} className={chip(view === "open")}>Open</Link>
              <Link href="/markets?view=settled" aria-current={view === "settled" ? "page" : undefined} className={chip(view === "settled")}>Settled</Link>
            </nav>
            {markets === null ? (
              <p className="mt-5 rounded-xl border border-line bg-surface p-4 text-sm text-ink-muted">
                Predictions aren’t available right now. <Link href="/login?next=%2Fmarkets" className="font-semibold text-brand-ink underline">Sign in</Link> with your McGill email to play.
              </p>
            ) : markets.length === 0 ? (
              <p className="mt-5 rounded-xl border border-line bg-surface p-6 text-center text-ink-muted">
                {view === "open" ? <>No open markets yet. <Link href="/markets/new" className="font-semibold text-brand-ink underline">Propose one</Link>.</> : "Nothing settled yet."}
              </p>
            ) : (
              <ul className="mt-5 grid gap-3">{markets.map((m) => <MarketCard key={m.id} market={m} now={now} />)}</ul>
            )}

            {proposals.length > 0 && (
              <section aria-labelledby="proposals-heading" className="mt-8">
                <h2 id="proposals-heading" className="text-lg font-bold">Your proposals</h2>
                <ul className="mt-2 divide-y divide-line rounded-2xl border border-line bg-surface">
                  {proposals.map((m) => (
                    <li key={m.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                      <Link href={`/markets/${m.id}`} className="min-w-0 font-semibold text-ink [overflow-wrap:anywhere] hover:underline">{m.question}</Link>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ${m.status === "pending" ? "bg-warn-soft text-warn-ink" : "bg-surface-muted text-ink-muted"}`}>{m.status === "pending" ? "Waiting for review" : "Not approved"}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </section>

          <aside aria-labelledby="forecasters-heading" className="mt-10 space-y-6 lg:mt-0">
            <section className="rounded-2xl border border-line bg-surface p-4 shadow-sm">
              <h2 id="forecasters-heading" className="flex items-center gap-2 text-lg font-bold"><Trophy aria-hidden="true" size={18} className="text-amber-500" />Top forecasters</h2>
              {leaderboard && leaderboard.top.length > 0 ? (
                <ol className="mt-3 space-y-1.5 text-sm">
                  {leaderboard.top.map((e) => (
                    <li key={`${e.rank}-${e.name}`} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${e.me ? "bg-brand-soft" : ""}`}>
                      <span className="w-6 font-bold tabular-nums text-ink-muted">{e.rank}</span>
                      <span className="min-w-0 flex-1 truncate font-semibold text-ink">{e.name}{e.me && <span className="sr-only"> (you)</span>}</span>
                      <span className={`font-bold tabular-nums ${e.profit >= 0 ? "text-ok-ink" : "text-ink-muted"}`}>{e.profit >= 0 ? "+" : "−"}{Math.abs(e.profit)}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="mt-2 text-sm text-ink-muted">Ranks appear once markets settle.</p>
              )}
              {leaderboard?.me && !leaderboard.top.some((e) => e.me) && (
                <p className="mt-3 border-t border-line pt-2 text-sm text-ink-2">You: #{leaderboard.me.rank}, {leaderboard.me.profit >= 0 ? "+" : "−"}{Math.abs(leaderboard.me.profit)} points</p>
              )}
              <p className="mt-3 text-xs text-ink-muted">Points won minus points spent on settled markets.</p>
            </section>
            <section className="rounded-2xl border border-line bg-surface p-4 text-sm text-ink-2 shadow-sm">
              <h2 className="flex items-center gap-2 text-lg font-bold text-ink"><TrendingUp aria-hidden="true" size={18} className="text-brand-ink" />How it works</h2>
              <ul className="mt-2 list-disc space-y-1.5 pl-5">
                <li>Everyone gets 1000 points, topped back up to 1000 each week.</li>
                <li>A share’s price is its probability: when Yes is at 64%, a Yes share costs 0.64 points.</li>
                <li>Each winning share pays 1 point when a moderator settles the market.</li>
                <li>Sell anytime before it closes. Cancelled markets refund everyone.</li>
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
