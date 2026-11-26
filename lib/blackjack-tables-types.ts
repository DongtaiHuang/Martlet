// Client-safe types and constants for multiplayer blackjack tables (ADR 0035).
import type { Result } from "@/lib/blackjack-engine";

export type SeatStatus = "seated" | "bet" | "playing" | "stood" | "bust" | "blackjack" | "out";
export interface TableSeat {
  seat: number; name: string; me: boolean; bet: number; cards: number[]; value: number;
  status: SeatStatus; result: Result | null; payout: number; doubled: boolean;
  /** Hand 2 after a split (ADR 0041); `active` is the hand in play. payout covers both hands. */
  split_cards: number[] | null; split_value: number; split_bet: number; split_doubled: boolean; split_result: Result | null; active: 1 | 2;
}
export interface TableState {
  id: string; name: string; phase: "open" | "betting" | "playing"; round: number; version: number;
  dealer: number[]; dealer_value: number; dealer_hidden: boolean;
  turn_seat: number | null; deadline: string | null; now: string;
  seats: TableSeat[]; my_seat: number | null; balance: number | null;
}
export interface TableSummary { id: string; name: string; phase: TableState["phase"]; players: number; mine: boolean }

export const SEATS = 5;

/** Table chat (ADR 0041): the table you're seated at and its last 50 messages of the day. */
export interface ChatMessage { id: string; name: string; body: string; mine: boolean; at: string }
export interface TableChat { table_id: string; table_name: string; messages: ChatMessage[] }
export const CHAT_MAX = 200;
