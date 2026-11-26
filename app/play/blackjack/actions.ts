"use server";

import { BlackjackError, dealHand, playHand } from "@/lib/blackjack";
import { isAction, MAX_BET, MIN_BET, type HandState } from "@/lib/blackjack-engine";
import { AuthRequiredError } from "@/lib/supabase/auth";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type BlackjackResponse = { hand?: HandState; error?: string };

function friendly(error: unknown): string {
  if (error instanceof BlackjackError) return error.message;
  if (error instanceof AuthRequiredError) return "Sign in to play.";
  console.error("Blackjack action failed", error);
  return "Something went wrong. Try again.";
}

export async function dealAction(bet: number): Promise<BlackjackResponse> {
  if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET) return { error: `Bet between ${MIN_BET} and ${MAX_BET} points.` };
  try { return { hand: await dealHand(bet) }; } catch (error) { return { error: friendly(error) }; }
}

export async function handAction(id: string, action: string): Promise<BlackjackResponse> {
  if (!UUID.test(id)) return { error: "That hand isn't available." };
  if (!isAction(action)) return { error: "Pick hit, stand, double or split." };
  try { return { hand: await playHand(id, action) }; } catch (error) { return { error: friendly(error) }; }
}
