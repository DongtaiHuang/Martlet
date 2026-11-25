// Campus prediction market (issue #139, ADR 0033). Play money only: points have no cash value.
// Components call these, not Supabase directly. Writes go through migration 018's functions,
// which take the user from the session, lock rows and check balances.
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import { probability, type Side } from "@/lib/market-math";
import { MOCK_MARKETS, mockHistory } from "@/lib/mock-markets";

export type MarketStatus = "pending" | "open" | "rejected" | "resolved" | "cancelled";
export interface Market {
  id: string; question: string; details: string; closes_at: string; status: MarketStatus;
  outcome: "yes" | "no" | null; liquidity: number; q_yes: number; q_no: number; volume: number;
  created_at: string; is_mine: boolean;
  /** YES probability now (the YES share price). */
  probability: number;
}
export interface HistoryPoint { t: number; p: number }
export interface Position { yes_shares: number; no_shares: number; net_spent: number; payout: number | null }
export interface LeaderboardEntry { rank: number; name: string; profit: number; markets: number; me: boolean }
export interface MarketPage { market: Market; history: HistoryPoint[]; position: Position | null; balance: number | null; moderator: boolean; preview: boolean }

export const START_BALANCE = 1000;
export const MAX_BUY = 500;

export class MarketError extends Error {}

const SELECT = "id, question, details, closes_at, status, outcome, liquidity, q_yes, q_no, volume, created_at, creator_id";
type Row = Omit<Market, "is_mine" | "probability"> & { creator_id: string };

async function session() {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub ?? null;
  return userId ? { supabase, userId } : null;
}

function toMarket(row: Row, userId: string | null): Market {
  const { creator_id, ...rest } = row;
  return { ...rest, is_mine: creator_id === userId, probability: probability({ b: row.liquidity, yes: row.q_yes, no: row.q_no }) };
}

/** Preview mode: sample markets, no trading. */
export const isPreview = () => getDataMode() === "mock";

/** Open or settled markets. null when signed out or migration 018 isn't applied. */
export async function listMarkets(view: "open" | "settled"): Promise<Market[] | null> {
  if (isPreview()) return MOCK_MARKETS.filter((m) => (view === "open" ? m.status === "open" : m.status === "resolved" || m.status === "cancelled"));
  const s = await session();
  if (!s) return null;
  const base = s.supabase.from("markets").select(SELECT).limit(100);
  const q = view === "open"
    ? base.eq("status", "open").order("closes_at", { ascending: true })
    : base.in("status", ["resolved", "cancelled"]).order("resolved_at", { ascending: false });
  const { data, error } = await q.returns<Row[]>();
  if (error) { console.warn("listMarkets failed", error.message); return null; }
  return data.map((r) => toMarket(r, s.userId));
}

/** The caller's own proposals still waiting for review, or rejected. */
export async function listMyProposals(): Promise<Market[]> {
  const s = await session();
  if (!s) return [];
  const { data } = await s.supabase.from("markets").select(SELECT).eq("creator_id", s.userId).in("status", ["pending", "rejected"])
    .order("created_at", { ascending: false }).limit(10).returns<Row[]>();
  return (data ?? []).map((r) => toMarket(r, s.userId));
}

export async function getBalance(): Promise<number | null> {
  if (isPreview()) return START_BALANCE;
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("market_wallet");
  return error ? null : (data as number);
}

export async function isMarketModerator(): Promise<boolean> {
  const s = await session();
  if (!s) return false;
  const { data } = await s.supabase.rpc("is_moderator");
  return data === true;
}

function parseHistory(raw: unknown): HistoryPoint[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((pt: { t?: unknown; p?: unknown }) => {
    const t = Date.parse(String(pt?.t)), p = Number(pt?.p);
    return Number.isFinite(t) && p > 0 && p < 1 ? [{ t, p }] : [];
  });
}

export async function getMarket(id: string): Promise<MarketPage | null> {
  if (isPreview()) {
    const market = MOCK_MARKETS.find((m) => m.id === id);
    return market ? { market, history: mockHistory(market), position: null, balance: START_BALANCE, moderator: false, preview: true } : null;
  }
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.supabase.from("markets").select(SELECT).eq("id", id).maybeSingle<Row>();
  if (error || !data) return null;
  const [history, position, balance, moderator] = await Promise.all([
    s.supabase.rpc("get_market_history", { p_market: id }),
    s.supabase.from("market_positions").select("yes_shares, no_shares, net_spent, payout").eq("market_id", id).eq("user_id", s.userId).maybeSingle<Position>(),
    s.supabase.rpc("market_wallet"),
    s.supabase.rpc("is_moderator"),
  ]);
  return {
    market: toMarket(data, s.userId),
    history: parseHistory(history.data),
    position: position.data ?? null,
    balance: balance.error ? null : (balance.data as number),
    moderator: moderator.data === true,
    preview: false,
  };
}

export async function listPendingMarkets(): Promise<Market[]> {
  const s = await session();
  if (!s) return [];
  const { data } = await s.supabase.from("markets").select(SELECT).eq("status", "pending").order("created_at").limit(50).returns<Row[]>();
  return (data ?? []).map((r) => toMarket(r, s.userId));
}

export type Leaderboard = { top: LeaderboardEntry[]; me: { rank: number; profit: number; markets: number } | null };

export async function getMarketLeaderboard(limit = 5): Promise<Leaderboard | null> {
  if (isPreview()) return { top: [], me: null };
  const s = await session();
  if (!s) return null;
  const { data, error } = await s.supabase.rpc("get_market_leaderboard", { p_limit: limit });
  if (error || !data) return null;
  return data as Leaderboard;
}

// Writes -----------------------------------------------------------------------------------
function rpcError(error: { message: string; hint?: string; code?: string }): never {
  if (error.hint === "rate-limit") {
    throw new MarketError(error.message.startsWith("proposing") ? "You can propose 3 markets a day. Try again tomorrow." : "That's a lot of trades! Wait a minute and try again.");
  }
  if (error.hint === "closed") throw new MarketError("This market isn't open for trading any more.");
  if (error.hint === "balance") throw new MarketError("You don't have enough points for that.");
  if (error.hint === "shares") throw new MarketError("You don't have that many shares to sell.");
  if (error.hint === "conflict") throw new MarketError("You have a position in this market, so another moderator needs to settle it.");
  if (error.hint === "limit") throw new MarketError("That trade is too large for this market. Try a smaller amount.");
  if (error.code === "22023") throw new MarketError(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  if (error.code === "23514") throw new MarketError("Check the form: the question needs 10 to 140 characters and the details up to 1000.");
  if (error.code === "P0002") throw new MarketError("That market isn't waiting for this any more. Refresh the page.");
  if (error.code === "42501") throw new MarketError("You can't do that.");
  throw new Error(error.message);
}

function requireLive() {
  if (isPreview()) throw new MarketError("This is a preview with sample markets. Trading needs Supabase.");
}

export async function proposeMarket(input: { question: string; details: string; closesAt: string }): Promise<string> {
  requireLive();
  await requireUser();
  const { data, error } = await (await createClient()).rpc("create_market", { p_question: input.question, p_details: input.details, p_closes_at: input.closesAt });
  if (error) rpcError(error);
  return data as string;
}

export interface TradeResult { shares: number; points: number; probability: number; balance: number }

export async function tradeMarket(id: string, side: Side, action: "buy" | "sell", amount: number): Promise<TradeResult> {
  requireLive();
  await requireUser();
  const { data, error } = await (await createClient()).rpc("trade_market", { p_market: id, p_side: side, p_action: action, p_amount: amount });
  if (error) rpcError(error);
  return data as TradeResult;
}

export async function reviewMarket(id: string, approve: boolean) {
  requireLive();
  await requireUser();
  const { error } = await (await createClient()).rpc("review_market", { p_market: id, p_approve: approve });
  if (error) rpcError(error);
}

export async function resolveMarket(id: string, outcome: "yes" | "no" | "cancelled"): Promise<number> {
  requireLive();
  await requireUser();
  const { data, error } = await (await createClient()).rpc("resolve_market", { p_market: id, p_outcome: outcome });
  if (error) rpcError(error);
  return data as number;
}
