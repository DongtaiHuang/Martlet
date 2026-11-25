// Sample markets for preview mode (no Supabase). Not real forecasts.
import type { HistoryPoint, Market } from "@/lib/markets";
import { probability } from "@/lib/market-math";

const HOUR = 3_600_000;
const at = (hours: number) => new Date(Date.now() + hours * HOUR).toISOString();
// The pool for a target probability: yes - no = b·ln(p / (1 - p)).
const pool = (p: number, b = 300) => ({ q_yes: b * Math.log(p / (1 - p)), q_no: 0, liquidity: b });

function market(id: string, question: string, details: string, p: number, closesInHours: number, volume: number, extra: Partial<Market> = {}): Market {
  const m = { id, question, details, closes_at: at(closesInHours), status: "open" as Market["status"], outcome: null, volume, created_at: at(-24 * 6), is_mine: false, ...pool(p), ...extra };
  return { ...m, probability: probability({ b: m.liquidity, yes: m.q_yes, no: m.q_no }) };
}

export const MOCK_MARKETS: Market[] = [
  market("demo-redpath", "Will Redpath stay open 24/7 during December finals?", "Resolves YES if the McGill Library hours page lists Redpath as open 24 hours for the whole exam period.", 0.72, 24 * 9, 1840),
  market("demo-snow", "Will Montreal get 10 cm of snow in one day before December 1?", "Resolves YES if Environment Canada reports at least 10 cm of snowfall at Montréal–Trudeau on a single day before Dec 1.", 0.31, 24 * 5, 960),
  market("demo-redbirds", "Will the Redbirds win Saturday's home game?", "Resolves YES if McGill wins the Saturday game at Molson Stadium. Cancelled if the game is postponed.", 0.55, 60, 2310),
  market("demo-gerts", "Will Gerts host a trivia night this week?", "Resolves YES if the Gerts events page lists a trivia night this week.", 0.93, -48, 610, { status: "resolved", outcome: "yes" }),
];

/** A deterministic wandering history that ends at the market's current probability. */
export function mockHistory(m: Market): HistoryPoint[] {
  const start = Date.parse(m.created_at), end = Math.min(Date.now(), Date.parse(m.closes_at));
  const n = 24;
  let seed = [...m.id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
  const rand = () => (seed = (seed * 1103515245 + 12345) >>> 0) / 2 ** 32;
  const points: HistoryPoint[] = [{ t: start, p: 0.5 }];
  for (let i = 1; i < n; i++) {
    const drift = 0.5 + (m.probability - 0.5) * (i / n);
    points.push({ t: start + ((end - start) * i) / n, p: Math.min(0.97, Math.max(0.03, drift + (rand() - 0.5) * 0.14)) });
  }
  points.push({ t: end - 60_000, p: m.probability });
  return points;
}
