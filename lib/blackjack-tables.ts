// Multiplayer blackjack tables (issue #146, ADR 0035). Server-only: components call these through
// the server actions in app/play/blackjack/tables/actions.ts. The database (migration 020) deals,
// times turns and pays; it never returns the deck or the dealer's hole card during a hand.
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export { SEATS, type SeatStatus, type TableSeat, type TableState, type TableSummary } from "@/lib/blackjack-tables-types";
import type { TableState, TableSummary } from "@/lib/blackjack-tables-types";

export class TableError extends Error {}

/** null when signed out, in preview mode, or before migration 020. */
export async function listTables(): Promise<TableSummary[] | null> {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const { data, error } = await supabase.rpc("bj_list_tables");
  if (error) { console.warn("bj_list_tables failed", error.message); return null; }
  return data as TableSummary[];
}

function rpcError(error: { message: string; hint?: string; code?: string }): never {
  const byHint: Record<string, string> = {
    active: "Finish your hand first.",
    full: "This table is full. Try another one.",
    seat: "Take a seat first.",
    round: "A hand is in play. Bet when it's over.",
    already: "You've already bet this round.",
    balance: "You don't have enough points for that.",
    turn: "It isn't your turn.",
    "daily-limit": "That's 100 hands today. The tables reopen tomorrow.",
  };
  if (error.hint && byHint[error.hint]) throw new TableError(byHint[error.hint]);
  if (error.code === "22023") throw new TableError(error.message.charAt(0).toUpperCase() + error.message.slice(1) + ".");
  if (error.code === "P0002") throw new TableError("That table doesn't exist.");
  throw new Error(error.message);
}

async function call<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  await requireUser();
  const { data, error } = await (await createClient()).rpc(fn, args);
  if (error) rpcError(error);
  return data as T;
}

export const syncTable = (id: string) => call<TableState>("bj_sync", { p_table: id });
export const joinTable = (id: string) => call<TableState>("bj_join", { p_table: id });
export const leaveTable = (id: string) => call<null>("bj_leave", { p_table: id });
export const betAtTable = (id: string, bet: number) => call<TableState>("bj_bet", { p_table: id, p_bet: bet });
export const actAtTable = (id: string, action: "hit" | "stand" | "double") => call<TableState>("bj_act", { p_table: id, p_action: action });
