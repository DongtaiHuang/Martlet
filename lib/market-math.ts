// Prediction market pricing (issue #139, ADR 0033): a logarithmic market scoring rule (LMSR).
// Mirrors the SQL in migration 018 so the trade form can preview a trade; the database is the
// source of truth. Play money only: points can't be bought, cashed out or exchanged.
//
// A YES share pays 1 point if the market resolves YES, a NO share pays 1 point if it resolves NO.
// The market maker always quotes a price; `b` (liquidity) sets how far a trade moves it.

export type Side = "yes" | "no";
export interface Pool { b: number; yes: number; no: number }

/** Total cost function C(q) = b·ln(e^(yes/b) + e^(no/b)), computed without overflow. */
export function cost({ b, yes, no }: Pool): number {
  const m = Math.max(yes, no);
  return m + b * Math.log(Math.exp((yes - m) / b) + Math.exp((no - m) / b));
}

/** Probability of YES implied by the pool (the YES share price). */
export function probability({ b, yes, no }: Pool): number {
  return 1 / (1 + Math.exp((no - yes) / b));
}

/** Shares received for spending `points` on `side`. */
export function sharesForPoints(pool: Pool, side: Side, points: number): number {
  if (!(points > 0)) return 0;
  const target = cost(pool) + points;
  const other = side === "yes" ? pool.no : pool.yes;
  const mine = side === "yes" ? pool.yes : pool.no;
  // Solve C(mine', other) = target for mine'.
  const next = target + pool.b * Math.log(1 - Math.exp((other - target) / pool.b));
  return next - mine;
}

/** Points paid back for selling `shares` of `side`. */
export function pointsForShares(pool: Pool, side: Side, shares: number): number {
  if (!(shares > 0)) return 0;
  const after = side === "yes" ? { ...pool, yes: pool.yes - shares } : { ...pool, no: pool.no - shares };
  return cost(pool) - cost(after);
}

export function applyTrade(pool: Pool, side: Side, shares: number): Pool {
  return side === "yes" ? { ...pool, yes: pool.yes + shares } : { ...pool, no: pool.no + shares };
}

export const formatPercent = (p: number) => `${Math.round(p * 100)}%`;
