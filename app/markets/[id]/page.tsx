import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Clock, Coins, FlaskConical, ShieldCheck } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { ProbabilityChart } from "@/components/markets/ProbabilityChart";
import { ResolveForm } from "@/components/markets/ResolveForm";
import { TradeForm } from "@/components/markets/TradeForm";
import { closesLabel, formatShares, formatWhen } from "@/components/markets/format";
import { getMarket, MAX_BUY } from "@/lib/markets";

export const metadata: Metadata = { title: "Prediction · McGill Martlet" };
export const dynamic = "force-dynamic";

async function load(id: string) {
  const page = await getMarket(id);
  if (!page) notFound();
  return { ...page, now: Date.now() };
}

const STATUS_NOTE: Record<string, string> = {
  pending: "Waiting for a moderator to review. Trading opens once it’s approved.",
  rejected: "A moderator didn’t approve this market.",
};

export default async function MarketPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ proposed?: string }> }) {
  const [{ id }, { proposed }] = await Promise.all([params, searchParams]);
  const { market, history, position, balance, moderator, preview, now } = await load(id);
  const open = market.status === "open" && Date.parse(market.closes_at) > now;
  const settled = market.status === "resolved" || market.status === "cancelled";
  const p = Math.round(market.probability * 100);
  const held = { yes: position?.yes_shares ?? 0, no: position?.no_shares ?? 0 };
  const hasPosition = held.yes > 0 || held.no > 0 || (position?.net_spent ?? 0) !== 0;

  // Preview mode keeps the form so the trade preview can be tried; submitting explains it needs Supabase.
  const disabledReason = balance === null ? "Sign in to trade."
    : !open ? (settled ? "This market is settled." : market.status === "open" ? "Trading has closed. A moderator will settle it soon." : STATUS_NOTE[market.status] ?? "Trading isn’t open.")
    : undefined;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-5xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/markets" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-brand-ink hover:underline"><ArrowLeft aria-hidden="true" size={16} /> All predictions</Link>
        {proposed === "1" && (
          <p role="status" className="mt-3 flex items-center gap-2 rounded-xl border border-ok-line bg-ok-soft px-4 py-3 text-sm font-semibold text-ok-ink">
            <CheckCircle2 aria-hidden="true" size={17} /> {market.status === "open" ? "Your market is open for trading." : "Proposed! A moderator will review it soon."}
          </p>
        )}
        {preview && (
          <p className="mt-3 flex flex-wrap items-center gap-1.5 rounded-xl border border-warn-line bg-warn-soft px-3 py-2 text-sm text-warn-ink">
            <FlaskConical aria-hidden="true" size={15} /><span><strong>Preview:</strong> a sample market, not a real forecast.</span>
          </p>
        )}

        <div className="mt-4 gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
          <article className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
            <p className="flex flex-wrap items-center gap-2 text-xs font-semibold text-ink-muted">
              <Clock aria-hidden="true" size={14} />
              {settled ? `Settled ${market.status === "cancelled" ? "(cancelled, refunded)" : ""}`.trim() : market.status === "open" ? `${closesLabel(market.closes_at, now)} · ${formatWhen(market.closes_at)}` : STATUS_NOTE[market.status]}
              <span aria-hidden="true">·</span>{market.volume.toLocaleString("en-CA")} points traded
            </p>
            <h1 className="mt-2 text-2xl font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-3xl">{market.question}</h1>

            <div className="mt-5 flex flex-wrap items-end gap-x-6 gap-y-2">
              {settled ? (
                <p className="text-3xl font-extrabold text-ink">{market.status === "cancelled" ? "Cancelled" : `Resolved ${market.outcome === "yes" ? "Yes" : "No"}`}</p>
              ) : (
                <p><span className="text-4xl font-extrabold tabular-nums text-ink">{p}%</span> <span className="text-sm font-semibold text-ink-muted">chance of yes</span></p>
              )}
            </div>

            <section aria-labelledby="chart-heading" className="mt-5">
              <h2 id="chart-heading" className="text-sm font-bold text-ink-2">Chance of yes over time</h2>
              <div className="mt-2">
                <ProbabilityChart history={history} now={settled ? history[history.length - 1]?.t ?? now : Math.min(now, Date.parse(market.closes_at))} label="Chance of yes over time" />
              </div>
            </section>

            <section aria-labelledby="rules-heading" className="mt-6 border-t border-line pt-5">
              <h2 id="rules-heading" className="text-sm font-bold text-ink">How it resolves</h2>
              <p className="mt-1 whitespace-pre-line text-sm text-ink-2 [overflow-wrap:anywhere]">{market.details || "No details given."}</p>
            </section>
          </article>

          <aside aria-label="Trade" className="mt-6 space-y-6 lg:mt-0">
            <section aria-labelledby="trade-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
              <div className="flex items-baseline justify-between gap-2">
                <h2 id="trade-heading" className="text-lg font-bold">Trade</h2>
                {balance !== null && <p className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2"><Coins aria-hidden="true" size={15} className="text-amber-600 dark:text-amber-300" />{balance.toLocaleString("en-CA")} points</p>}
              </div>
              <div className="mt-3">
                <TradeForm
                  marketId={market.id} pool={{ b: market.liquidity, yes: market.q_yes, no: market.q_no }}
                  balance={balance ?? 0} held={held} maxBuy={MAX_BUY} disabledReason={disabledReason}
                />
              </div>
            </section>

            {hasPosition && position && (
              <section aria-labelledby="position-heading" className="rounded-2xl border border-line bg-surface p-5 text-sm shadow-sm">
                <h2 id="position-heading" className="text-lg font-bold">Your position</h2>
                <dl className="mt-2 grid grid-cols-2 gap-y-1.5">
                  <dt className="text-ink-muted">Yes shares</dt><dd className="text-right font-semibold tabular-nums">{formatShares(held.yes)}</dd>
                  <dt className="text-ink-muted">No shares</dt><dd className="text-right font-semibold tabular-nums">{formatShares(held.no)}</dd>
                  <dt className="text-ink-muted">Points put in</dt><dd className="text-right font-semibold tabular-nums">{position.net_spent}</dd>
                  {position.payout !== null && <><dt className="text-ink-muted">Paid out</dt><dd className="text-right font-bold tabular-nums text-ok-ink">{position.payout}</dd></>}
                </dl>
                {!settled && <p className="mt-2 text-xs text-ink-muted">If Yes wins you get {Math.floor(held.yes)} points; if No wins, {Math.floor(held.no)}.</p>}
              </section>
            )}

            {moderator && market.status === "open" && (
              <section aria-labelledby="settle-heading" className="rounded-2xl border border-brand-line bg-brand-soft p-5 shadow-sm">
                <h2 id="settle-heading" className="flex items-center gap-2 text-lg font-bold"><ShieldCheck aria-hidden="true" size={18} />Settle (moderators)</h2>
                {hasPosition
                  ? <p className="mt-2 text-sm text-ink-2">You have a position in this market, so another moderator needs to settle it.</p>
                  : <div className="mt-3"><ResolveForm marketId={market.id} /></div>}
              </section>
            )}
          </aside>
        </div>
      </main>
    </div>
  );
}
