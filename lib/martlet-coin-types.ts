// Client-safe types and constants for Martlet Coin (ADR 0036). Mirrors migration 021.

export const COIN_RANGES = ["1h", "1d", "7d"] as const;
export type CoinRange = (typeof COIN_RANGES)[number];
export const MAX_COIN_BUY = 500;
/** Buys fill 0.5% above the price, sales 0.5% below. */
export const SPREAD = 0.005;

export interface CoinSnapshot {
  preview: boolean;
  range: CoinRange;
  quote: { price: number; open: number; high: number; low: number; volume: number; traders: number; at: string };
  history: { t: number; p: number }[];
  portfolio: {
    coins: number; spent: number; received: number; value: number; profit: number; balance: number;
    trades: { side: "buy" | "sell"; coins: number; points: number; price: number; at: string }[];
  };
  leaderboard: { top: { rank: number; name: string; profit: number; me: boolean }[]; me: { rank: number; profit: number } | null };
}

/** Same rounding as mlt_trade: 4-decimal fill price, coins truncated to 6 decimals, sales floored. */
export const fillPrice = (price: number, side: "buy" | "sell") => Math.round(price * (side === "buy" ? 1 + SPREAD : 1 - SPREAD) * 10_000) / 10_000;
export const coinsForPoints = (points: number, price: number) => Math.floor((points / fillPrice(price, "buy")) * 1e6) / 1e6;
export const pointsForCoins = (coins: number, price: number) => Math.floor(coins * fillPrice(price, "sell"));
/** Rounded down, so it never shows more coins than you hold. */
export function formatCoins(n: number): string {
  const d = n >= 100 ? 2 : n >= 1 ? 4 : 6;
  return (Math.floor(n * 10 ** d + 1e-9) / 10 ** d).toFixed(d);
}
export const formatPrice = (n: number) => n.toFixed(n >= 100 ? 2 : 4);
