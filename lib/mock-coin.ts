// Preview-mode sample for Martlet Coin: a deterministic random walk, no trading.
import type { CoinRange, CoinSnapshot } from "@/lib/martlet-coin-types";

const MINUTE = 60_000;
const STEP: Record<CoinRange, number> = { "1h": 1, "1d": 5, "7d": 60 };
const SPAN: Record<CoinRange, number> = { "1h": 60, "1d": 1440, "7d": 10_080 };

/** Same model as mlt_tick (mean reversion to 10, 0.4% noise), seeded so the chart is stable. */
function series(minutes: number, endMinute: number): { t: number; p: number }[] {
  let seed = 20261125;
  const rand = () => ((seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32) || 1e-9;
  let p = 10;
  const out: { t: number; p: number }[] = [];
  for (let i = minutes; i >= 0; i--) {
    const z = Math.sqrt(-2 * Math.log(rand())) * Math.cos(2 * Math.PI * rand());
    p = Math.min(1000, Math.max(0.5, p * Math.exp(-0.002 * Math.log(p / 10) + 0.004 * z)));
    out.push({ t: (endMinute - i) * MINUTE, p: Math.round(p * 10_000) / 10_000 });
  }
  return out;
}

export function mockCoinSnapshot(range: CoinRange): CoinSnapshot {
  const endMinute = Math.floor(Date.now() / MINUTE);
  const week = series(SPAN["7d"], endMinute);
  const price = week[week.length - 1].p;
  const day = week.slice(-1441);
  const history = week.slice(-(SPAN[range] + 1)).filter((pt, i, all) => (pt.t / MINUTE) % STEP[range] === 0 || i === all.length - 1);
  return {
    preview: true, range,
    quote: { price, open: day[0].p, high: Math.max(...day.map((d) => d.p)), low: Math.min(...day.map((d) => d.p)), volume: 4210, traders: 37, at: new Date(endMinute * MINUTE).toISOString() },
    history,
    portfolio: { coins: 0, spent: 0, received: 0, value: 0, profit: 0, balance: 1000, trades: [] },
    leaderboard: { top: [], me: null },
  };
}
