// Martlet Coin (MLT): a simulated coin for a trading sim (issue #148, ADR 0036). Not a
// cryptocurrency. Bought and sold with Martlet points, which are play money (ADR 0033).
// Server-only; the database (migration 021) sets the price and fills every trade.
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { mockCoinSnapshot } from "@/lib/mock-coin";
import type { CoinRange, CoinSnapshot } from "@/lib/martlet-coin-types";

export { COIN_RANGES, MAX_COIN_BUY, SPREAD, type CoinRange, type CoinSnapshot } from "@/lib/martlet-coin-types";

export class CoinError extends Error {}

/** Price, chart, your portfolio and the leaderboard. Preview mode returns sample data. null when signed out. */
export async function getCoinSnapshot(range: CoinRange): Promise<CoinSnapshot | null> {
  if (getDataMode() === "mock") return mockCoinSnapshot(range);
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const [quote, history, portfolio, leaderboard] = await Promise.all([
    supabase.rpc("mlt_quote"), supabase.rpc("mlt_history", { p_range: range }),
    supabase.rpc("mlt_portfolio"), supabase.rpc("mlt_leaderboard", { p_limit: 5 }),
  ]);
  const failed = quote.error ?? history.error ?? portfolio.error ?? leaderboard.error;
  if (failed) { console.warn("Martlet Coin unavailable", failed.message); return null; }
  const num = (v: unknown) => Number(v);
  const q = quote.data as Record<string, unknown>;
  const p = portfolio.data as Record<string, unknown>;
  return {
    preview: false, range,
    quote: { price: num(q.price), open: num(q.open_24h), high: num(q.high_24h), low: num(q.low_24h), volume: num(q.volume_24h), traders: num(q.traders_24h), at: String(q.at) },
    history: (history.data as { t: string; p: number }[]).map((pt) => ({ t: Date.parse(pt.t), p: num(pt.p) })),
    portfolio: {
      coins: num(p.coins), spent: num(p.spent), received: num(p.received), value: num(p.value), profit: num(p.profit), balance: num(p.balance),
      trades: (p.trades as { side: "buy" | "sell"; coins: number; points: number; price: number; at: string }[]).map((t) => ({ ...t, coins: num(t.coins), price: num(t.price) })),
    },
    leaderboard: leaderboard.data as CoinSnapshot["leaderboard"],
  };
}

function rpcError(error: { message: string; hint?: string; code?: string }): never {
  if (error.hint === "rate-limit") throw new CoinError("That's a lot of trades! Wait a minute and try again.");
  if (error.hint === "balance") throw new CoinError("You don't have enough points for that.");
  if (error.hint === "coins") throw new CoinError("You don't have that many coins to sell.");
  if (error.code === "22023") throw new CoinError(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  throw new Error(error.message);
}

export async function tradeCoin(side: "buy" | "sell", amount: number) {
  if (getDataMode() === "mock") throw new CoinError("This is a preview with a sample price. Trading needs Supabase.");
  await requireUser();
  const { data, error } = await (await createClient()).rpc("mlt_trade", { p_side: side, p_amount: amount });
  if (error) rpcError(error);
  return data as { side: "buy" | "sell"; coins: number; points: number; price: number; fill: number; balance: number; held: number };
}
