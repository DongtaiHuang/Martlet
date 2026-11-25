"use client";

import { useActionState, useState } from "react";
import { applyTrade, pointsForShares, probability, sharesForPoints, type Pool, type Side } from "@/lib/market-math";
import { tradeAction, type MarketFormState } from "@/app/markets/actions";

const pct = (p: number) => `${Math.round(p * 100)}%`;
/** Rounded down, so a preview never promises more than the payout. */
const fmt = (n: number) => (n >= 10 ? (Math.floor(n * 10) / 10).toFixed(1) : (Math.floor(n * 100) / 100).toFixed(2));
/** Everything you hold, rounded down so it never asks to sell more than you have. */
const all = (n: number) => String(Math.floor(n * 10000) / 10000);

/**
 * Buy or sell YES/NO shares with play-money points (issue #139). The preview uses the same LMSR
 * math as the database (lib/market-math.ts); the database decides the real numbers.
 */
export function TradeForm({ marketId, pool, balance, held, maxBuy, disabledReason }: {
  marketId: string; pool: Pool; balance: number; held: { yes: number; no: number }; maxBuy: number; disabledReason?: string;
}) {
  const [state, action, pending] = useActionState<MarketFormState, FormData>(tradeAction.bind(null, marketId), {});
  const [side, setSide] = useState<Side>("yes");
  const [mode, setMode] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("50");
  const value = Number(amount);
  const canSell = held.yes > 0 || held.no > 0;
  const owned = side === "yes" ? held.yes : held.no;

  let preview: string | null = null;
  if (value > 0) {
    if (mode === "buy" && Number.isInteger(value) && value <= maxBuy) {
      const shares = sharesForPoints(pool, side, value);
      const after = probability(applyTrade(pool, side, shares));
      preview = `About ${fmt(shares)} shares at ${(value / shares).toFixed(2)} points each. Moves the market to ${pct(after)} yes. Pays ${Math.floor(shares)} points if ${side === "yes" ? "Yes" : "No"} wins.`;
    } else if (mode === "sell" && value <= owned + 1e-9) {
      const back = Math.floor(pointsForShares(pool, side, value));
      const after = probability(applyTrade(pool, side, -value));
      preview = `About ${back} points back. Moves the market to ${pct(after)} yes.`;
    }
  }

  const seg = (on: boolean) => `flex min-h-11 flex-1 items-center justify-center rounded-lg px-3 text-sm font-bold has-focus-visible:outline-2 has-focus-visible:outline-focus ${on ? "bg-surface text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`;

  if (disabledReason) {
    return <p className="rounded-xl border border-line bg-canvas p-4 text-sm text-ink-muted">{disabledReason}</p>;
  }

  return (
    <form action={action} className="space-y-4">
      <fieldset>
        <legend className="sr-only">Buy or sell</legend>
        <div className="flex gap-1 rounded-xl bg-surface-muted p-1">
          {(["buy", "sell"] as const).map((m) => (
            <label key={m} className={seg(mode === m)}>
              <input type="radio" name="action" value={m} checked={mode === m} disabled={m === "sell" && !canSell} onChange={() => { setMode(m); setAmount(m === "sell" ? all(owned) : "50"); }} className="sr-only" />
              {m === "buy" ? "Buy" : "Sell"}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="mb-1.5 text-sm font-bold text-ink">Outcome</legend>
        <div className="grid grid-cols-2 gap-2">
          {(["yes", "no"] as const).map((s) => {
            const price = s === "yes" ? probability(pool) : 1 - probability(pool);
            const on = side === s;
            return (
              <label key={s} className={`flex min-h-12 cursor-pointer items-center justify-between rounded-xl border-2 px-3 text-sm font-bold has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-focus ${on ? "border-brand bg-brand-soft text-ink" : "border-line text-ink-2 hover:border-line-strong"}`}>
                <input type="radio" name="side" value={s} checked={on} onChange={() => { setSide(s); if (mode === "sell") setAmount(all(s === "yes" ? held.yes : held.no)); }} className="sr-only" />
                <span>{s === "yes" ? "Yes" : "No"}</span>
                <span className="tabular-nums text-ink-muted">{Math.round(price * 100)}%</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div>
        <label htmlFor="trade-amount" className="text-sm font-bold text-ink">{mode === "buy" ? "Points to spend" : "Shares to sell"}</label>
        <input
          id="trade-amount" name="amount" inputMode={mode === "buy" ? "numeric" : "decimal"} required
          value={amount} onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
          aria-describedby="trade-help trade-preview"
          className="mt-1.5 block min-h-11 w-full rounded-xl border border-line-strong bg-surface px-3 text-base tabular-nums text-ink focus-visible:outline-2 focus-visible:outline-focus"
        />
        <p id="trade-help" className="mt-1 text-xs text-ink-muted">
          {mode === "buy" ? `You have ${balance} points. Up to ${maxBuy} per trade.` : `You hold ${fmt(owned)} ${side === "yes" ? "Yes" : "No"} shares.`}
        </p>
      </div>
      <p id="trade-preview" className="min-h-10 text-sm text-ink-2">{preview}</p>
      <button type="submit" disabled={pending || !preview} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {pending ? "Placing trade…" : `${mode === "buy" ? "Buy" : "Sell"} ${side === "yes" ? "Yes" : "No"}`}
      </button>
      <p role="status" className={`text-sm font-semibold ${state.error ? "text-brand-ink-strong" : "text-ok-ink"}`}>{state.error ?? state.ok ?? ""}</p>
    </form>
  );
}
