"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { ArrowDownRight, ArrowUpRight, Coins, Trophy } from "lucide-react";
import { coinSnapshotAction, tradeCoinAction } from "@/app/coin/actions";
import {
  COIN_RANGES, coinsForPoints, fillPrice, formatCoins, formatPrice, MAX_COIN_BUY, pointsForCoins,
  type CoinRange, type CoinSnapshot,
} from "@/lib/martlet-coin-types";
import { PriceChart } from "./PriceChart";

const RANGE_LABEL: Record<CoinRange, string> = { "1h": "1 hour", "1d": "1 day", "7d": "7 days" };
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : "±"}${Math.abs(n).toLocaleString("en-CA")}`;
/** Everything you hold, rounded down to 6 decimals so it never asks to sell more than you have. */
const allCoins = (n: number) => String(Math.floor(n * 1e6) / 1e6);

/** The trading sim (issue #148). Prices move once a minute, so it refreshes every 30 s. */
export function CoinDashboard({ initial }: { initial: CoinSnapshot }) {
  const [snap, setSnap] = useState(initial);
  const [range, setRange] = useState<CoinRange>(initial.range);
  const rangeRef = useRef(range);
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("50");
  const [message, setMessage] = useState<{ ok?: string; error?: string }>({});
  const [pending, start] = useTransition();

  useEffect(() => {
    const timer = setInterval(async () => {
      const r = await coinSnapshotAction(rangeRef.current);
      if (r.snapshot) setSnap(r.snapshot);
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  const changeRange = (r: CoinRange) => {
    setRange(r);
    rangeRef.current = r;
    start(async () => { const res = await coinSnapshotAction(r); if (res.snapshot) setSnap(res.snapshot); });
  };

  const { quote, portfolio, leaderboard } = snap;
  const change = quote.price - quote.open;
  const changePct = quote.open ? (change / quote.open) * 100 : 0;
  const up = change >= 0;
  const value = Number(amount);

  let preview: string | null = null;
  if (value > 0) {
    if (side === "buy" && Number.isInteger(value) && value <= MAX_COIN_BUY && value <= portfolio.balance) {
      preview = `About ${formatCoins(coinsForPoints(value, quote.price))} MLT at ${formatPrice(fillPrice(quote.price, "buy"))} points each (price + 0.5%).`;
    } else if (side === "sell" && value <= portfolio.coins + 1e-6) {
      preview = `About ${pointsForCoins(Math.min(value, portfolio.coins), quote.price)} points at ${formatPrice(fillPrice(quote.price, "sell"))} each (price − 0.5%).`;
    }
  }

  const submit = () => start(async () => {
    const r = await tradeCoinAction(side, value, range);
    setMessage({ ok: r.ok, error: r.error });
    if (r.snapshot) setSnap(r.snapshot);
    if (r.ok && side === "sell") setAmount(allCoins(r.snapshot?.portfolio.coins ?? 0));
  });

  const seg = (on: boolean) => `flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold has-focus-visible:outline-2 has-focus-visible:outline-focus ${on ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`;

  return (
    <div className="gap-6 lg:grid lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-labelledby="price-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
        <h2 id="price-heading" className="text-sm font-bold text-ink-2">MLT price</h2>
        <div className="mt-1 flex flex-wrap items-end gap-x-4 gap-y-1">
          <p className="text-4xl font-extrabold tabular-nums text-ink">{formatPrice(quote.price)} <span className="text-base font-semibold text-ink-muted">points</span></p>
          <p className={`inline-flex items-center gap-1 text-sm font-bold ${up ? "text-ok-ink" : "text-brand-ink-strong"}`}>
            {up ? <ArrowUpRight aria-hidden="true" size={16} /> : <ArrowDownRight aria-hidden="true" size={16} />}
            {up ? "Up" : "Down"} {Math.abs(changePct).toFixed(2)}% <span className="font-semibold text-ink-muted">in 24 h</span>
          </p>
        </div>
        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-ink-muted sm:grid-cols-4">
          <div><dt className="inline">24 h high </dt><dd className="inline font-semibold tabular-nums text-ink-2">{formatPrice(quote.high)}</dd></div>
          <div><dt className="inline">24 h low </dt><dd className="inline font-semibold tabular-nums text-ink-2">{formatPrice(quote.low)}</dd></div>
          <div><dt className="inline">Volume </dt><dd className="inline font-semibold tabular-nums text-ink-2">{quote.volume.toLocaleString("en-CA")} pts</dd></div>
          <div><dt className="inline">Traders </dt><dd className="inline font-semibold tabular-nums text-ink-2">{quote.traders}</dd></div>
        </dl>

        <div role="group" aria-label="Chart range" className="mt-4 inline-flex gap-1 rounded-xl bg-surface-muted p-1">
          {COIN_RANGES.map((r) => (
            <button key={r} type="button" aria-pressed={range === r} onClick={() => changeRange(r)}
              className={`min-h-10 rounded-lg px-3 text-sm font-bold focus-visible:outline-2 focus-visible:outline-focus ${range === r ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              {r.toUpperCase()}
            </button>
          ))}
        </div>
        <div className={`mt-3 transition-opacity ${pending ? "opacity-60" : ""}`}>
          <PriceChart points={snap.history} range={range} label={`Martlet Coin price, last ${RANGE_LABEL[range]}`} />
        </div>
        <p className="mt-2 text-xs text-ink-muted">The price moves once a minute: a simulated market, nudged by campus activity and by everyone’s buying and selling.</p>
      </section>

      <div className="mt-6 space-y-6 lg:mt-0">
        <section aria-labelledby="trade-heading" className="rounded-2xl border border-line bg-surface p-5 shadow-sm">
          <div className="flex items-baseline justify-between gap-2">
            <h2 id="trade-heading" className="text-lg font-bold">Trade</h2>
            <p className="inline-flex items-center gap-1 text-sm font-semibold text-ink-2"><Coins aria-hidden="true" size={15} className="text-amber-600 dark:text-amber-300" />{portfolio.balance.toLocaleString("en-CA")} points</p>
          </div>
          <form className="mt-3 space-y-4" onSubmit={(e) => { e.preventDefault(); if (preview) submit(); }}>
            <fieldset>
              <legend className="sr-only">Buy or sell</legend>
              <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
                {(["buy", "sell"] as const).map((sd) => (
                  <label key={sd} className={seg(side === sd)}>
                    <input type="radio" name="side" value={sd} checked={side === sd} disabled={sd === "sell" && portfolio.coins <= 0}
                      onChange={() => { setSide(sd); setAmount(sd === "sell" ? allCoins(portfolio.coins) : "50"); setMessage({}); }} className="sr-only" />
                    {sd === "buy" ? "Buy MLT" : "Sell MLT"}
                  </label>
                ))}
              </div>
            </fieldset>
            <div>
              <label htmlFor="coin-amount" className="text-sm font-bold text-ink">{side === "buy" ? "Points to spend" : "Coins to sell"}</label>
              <input id="coin-amount" inputMode={side === "buy" ? "numeric" : "decimal"} value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                aria-describedby="coin-help coin-preview"
                className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-base tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-focus" />
              <p id="coin-help" className="mt-1 text-xs text-ink-muted">{side === "buy" ? `Up to ${MAX_COIN_BUY} points per trade.` : `You hold ${formatCoins(portfolio.coins)} MLT.`}</p>
            </div>
            <p id="coin-preview" className="min-h-10 text-sm text-ink-2">{preview}</p>
            <button type="submit" disabled={pending || !preview || snap.preview}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
              {pending ? "Placing trade…" : side === "buy" ? "Buy MLT" : "Sell MLT"}
            </button>
            <p role="status" className={`text-sm font-semibold ${snap.preview ? "text-ink-muted" : message.error ? "text-brand-ink-strong" : "text-ok-ink"}`}>
              {snap.preview ? "Preview: a sample price. Trading needs Supabase." : message.error ?? message.ok ?? ""}
            </p>
          </form>
        </section>

        <section aria-labelledby="holdings-heading" className="rounded-2xl border border-line bg-surface p-5 text-sm shadow-sm">
          <h2 id="holdings-heading" className="text-lg font-bold">Your MLT</h2>
          <dl className="mt-2 grid grid-cols-2 gap-y-1.5">
            <dt className="text-ink-muted">Coins</dt><dd className="text-right font-semibold tabular-nums">{formatCoins(portfolio.coins)}</dd>
            <dt className="text-ink-muted">Worth now</dt><dd className="text-right font-semibold tabular-nums">{portfolio.value.toLocaleString("en-CA")} pts</dd>
            <dt className="text-ink-muted">Profit</dt>
            <dd className={`text-right font-bold tabular-nums ${portfolio.profit >= 0 ? "text-ok-ink" : "text-brand-ink-strong"}`}>{signed(portfolio.profit)} pts</dd>
          </dl>
          <p className="mt-2 text-xs text-ink-muted">Profit = points from sales + what your coins would sell for now − points spent.</p>
          {portfolio.trades.length > 0 && (
            <>
              <h3 className="mt-4 text-sm font-bold text-ink">Recent trades</h3>
              <ul className="mt-1 divide-y divide-line">
                {portfolio.trades.map((t, i) => (
                  <li key={`${t.at}-${i}`} className="flex justify-between gap-2 py-1.5 text-xs">
                    <span className="font-semibold text-ink-2">{t.side === "buy" ? "Bought" : "Sold"} {formatCoins(t.coins)}</span>
                    <span className="tabular-nums text-ink-muted">{t.side === "buy" ? "−" : "+"}{t.points} pts @ {formatPrice(t.price)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>

        <section aria-labelledby="traders-heading" className="rounded-2xl border border-line bg-surface p-5 text-sm shadow-sm">
          <h2 id="traders-heading" className="flex items-center gap-2 text-lg font-bold"><Trophy aria-hidden="true" size={18} className="text-amber-500" />Top traders</h2>
          {leaderboard.top.length > 0 ? (
            <ol className="mt-2 space-y-1">
              {leaderboard.top.map((e) => (
                <li key={`${e.rank}-${e.name}`} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${e.me ? "bg-brand-soft" : ""}`}>
                  <span className="w-6 font-bold tabular-nums text-ink-muted">{e.rank}</span>
                  <span className="min-w-0 flex-1 truncate font-semibold">{e.name}{e.me && <span className="sr-only"> (you)</span>}</span>
                  <span className={`font-bold tabular-nums ${e.profit >= 0 ? "text-ok-ink" : "text-ink-muted"}`}>{signed(e.profit)}</span>
                </li>
              ))}
            </ol>
          ) : <p className="mt-2 text-ink-muted">No trades yet. Be the first.</p>}
          {leaderboard.me && !leaderboard.top.some((e) => e.me) && <p className="mt-2 border-t border-line pt-2 text-ink-2">You: #{leaderboard.me.rank}, {signed(leaderboard.me.profit)} pts</p>}
        </section>
      </div>
    </div>
  );
}
