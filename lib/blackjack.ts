// Blackjack with Martlet points (ADR 0034). Components call these, not Supabase directly.
// The database deals and pays (migration 019); the browser never sees the deck or hole card.
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Action, HandState } from "@/lib/blackjack-engine";

export class BlackjackError extends Error {}
export interface BlackjackTable { hand: HandState | null; today: { hands: number; net: number }; balance: number }

export const isBlackjackPreview = () => getDataMode() === "mock";

/** Your hand in play (if any), today's record and balance. null when signed out or not set up. */
export async function getBlackjackTable(): Promise<BlackjackTable | null> {
  if (isBlackjackPreview()) return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const [current, wallet] = await Promise.all([supabase.rpc("blackjack_current"), supabase.rpc("market_wallet")]);
  if (current.error || wallet.error) { console.warn("blackjack unavailable", current.error?.message ?? wallet.error?.message); return null; }
  const data = current.data as { hand: HandState | null; today: { hands: number; net: number } };
  return { hand: data.hand, today: data.today, balance: wallet.data as number };
}

function rpcError(error: { message: string; hint?: string; code?: string }): never {
  if (error.hint === "balance") throw new BlackjackError("You don't have enough points for that bet.");
  if (error.hint === "active") throw new BlackjackError("Finish your current hand first.");
  if (error.hint === "daily-limit") throw new BlackjackError("That's 100 hands today. The table reopens tomorrow.");
  if (error.code === "22023") throw new BlackjackError(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  if (error.code === "P0002") throw new BlackjackError("That hand is already over. Deal a new one.");
  throw new Error(error.message);
}

export async function dealHand(bet: number): Promise<HandState> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc("blackjack_deal", { p_bet: bet });
  if (error) rpcError(error);
  return data as HandState;
}

export async function playHand(id: string, action: Action): Promise<HandState> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc("blackjack_action", { p_hand: id, p_action: action });
  if (error) rpcError(error);
  return data as HandState;
}
