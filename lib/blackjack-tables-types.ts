// Client-safe types and constants for multiplayer blackjack tables (ADR 0035).
import type { Result } from "@/lib/blackjack-engine";

export type SeatStatus = "seated" | "bet" | "playing" | "stood" | "bust" | "blackjack" | "out";
export interface TableSeat {
  seat: number; name: string; me: boolean; bet: number; cards: number[]; value: number;
  status: SeatStatus; result: Result | null; payout: number; doubled: boolean;
}
export interface TableState {
  id: string; name: string; phase: "open" | "betting" | "playing"; round: number; version: number;
  dealer: number[]; dealer_value: number; dealer_hidden: boolean;
  turn_seat: number | null; deadline: string | null; now: string;
  seats: TableSeat[]; my_seat: number | null; balance: number | null;
}
export interface TableSummary { id: string; name: string; phase: TableState["phase"]; players: number; mine: boolean }

export const SEATS = 5;
