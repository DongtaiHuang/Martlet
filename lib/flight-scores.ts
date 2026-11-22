// Martlet Flight leaderboard (ADR 0026): thin wrappers over the migration 016 RPCs.
// Scores are checked server-side against each run's start time; user ids come from the session.
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export type SubmitResult = "new-best" | "saved" | "rejected" | "guest" | "error";
export type LeaderboardRow = { rank: number; name: string; score: number; me: boolean };
export type Leaderboard = { top: LeaderboardRow[]; me: { rank: number; score: number } | null; players: number };

async function signedInClient() {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

/** Starts a timed run; null for guests or if the leaderboard isn't set up. */
export async function startFlightRun(): Promise<string | null> {
  const supabase = await signedInClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("start_flight_run");
  if (error) { console.warn("start_flight_run failed", error.message); return null; }
  return typeof data === "string" ? data : null;
}

export async function submitFlightScore(runId: string, score: number): Promise<SubmitResult> {
  const supabase = await signedInClient();
  if (!supabase) return "guest";
  const { data, error } = await supabase.rpc("submit_flight_score", { p_run: runId, p_score: score });
  if (error) { console.warn("submit_flight_score failed", error.message); return "error"; }
  return data === "new-best" || data === "saved" ? data : "rejected";
}

/** Top players and the caller's rank; null for guests or if not set up. */
export async function getFlightLeaderboard(limit = 10): Promise<Leaderboard | null> {
  const supabase = await signedInClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_flight_leaderboard", { p_limit: limit });
  if (error) { console.warn("get_flight_leaderboard failed", error.message); return null; }
  return data as Leaderboard;
}
