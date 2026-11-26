// Multiplayer blackjack tables (issue #146, ADR 0035). Server-only: components call these through
// the server actions in app/play/blackjack/tables/actions.ts and app/play/blackjack/chat-actions.ts. The database (migration 020) deals,
// times turns and pays; it never returns the deck or the dealer's hole card during a hand.
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Action } from "@/lib/blackjack-engine";

export { SEATS, type ChatMessage, type SeatStatus, type TableChat, type TableSeat, type TableState, type TableSummary } from "@/lib/blackjack-tables-types";
import type { TableChat, TableState, TableSummary } from "@/lib/blackjack-tables-types";

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
    rate: "You're sending messages too fast. Wait a moment.",
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
export const actAtTable = (id: string, action: Action) => call<TableState>("bj_act", { p_table: id, p_action: action });

// Table chat (ADR 0041, migration 028) --------------------------------------------------------

/** The chat at the table you're seated at, or null when you aren't seated (or signed out). */
export async function getTableChat(): Promise<TableChat | null> {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return null;
  const { data, error } = await supabase.rpc("bj_chat_recent");
  if (error) { console.warn("bj_chat_recent failed", error.message); return null; }
  return (data as TableChat | null) ?? null;
}

export async function sendTableChat(body: string): Promise<void> {
  try {
    await call<null>("bj_chat_send", { p_body: body });
  } catch (error) {
    if (error instanceof TableError && error.message === "Take a seat first.") throw new TableError("Sit at a table to chat.", { cause: error });
    throw error;
  }
}
