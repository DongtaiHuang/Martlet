"use server";

import { actAtTable, betAtTable, joinTable, leaveTable, syncTable, TableError, type TableState } from "@/lib/blackjack-tables";
import { MAX_BET, MIN_BET } from "@/lib/blackjack-engine";
import { AuthRequiredError } from "@/lib/supabase/auth";

const TABLE_ID = /^[a-z0-9-]{2,30}$/;
export type TableResponse = { state?: TableState; error?: string };

function friendly(error: unknown): string {
  if (error instanceof TableError) return error.message;
  if (error instanceof AuthRequiredError) return "Sign in to play.";
  console.error("Table action failed", error);
  return "Something went wrong. Try again.";
}

async function wrap(id: string, fn: () => Promise<TableState | null>): Promise<TableResponse> {
  if (!TABLE_ID.test(id)) return { error: "That table doesn't exist." };
  try {
    const state = await fn();
    return state ? { state } : {};
  } catch (error) {
    return { error: friendly(error) };
  }
}

export async function syncTableAction(id: string) { return wrap(id, () => syncTable(id)); }
export async function joinTableAction(id: string) { return wrap(id, () => joinTable(id)); }
export async function leaveTableAction(id: string) { return wrap(id, async () => { await leaveTable(id); return syncTable(id); }); }
export async function betTableAction(id: string, bet: number) {
  if (!Number.isInteger(bet) || bet < MIN_BET || bet > MAX_BET) return { error: `Bet between ${MIN_BET} and ${MAX_BET} points.` };
  return wrap(id, () => betAtTable(id, bet));
}
export async function actTableAction(id: string, action: string) {
  if (action !== "hit" && action !== "stand" && action !== "double") return { error: "Pick hit, stand or double." };
  return wrap(id, () => actAtTable(id, action));
}
