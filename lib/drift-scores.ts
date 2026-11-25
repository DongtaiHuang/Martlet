// Martlet Drift leaderboard (ADR 0037): thin wrappers over the migration 022 functions.
// Scores are checked server-side against each run's start time; user ids come from the session.
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Leaderboard, SubmitResult } from "@/lib/flight-scores";

export type { Leaderboard, SubmitResult } from "@/lib/flight-scores";

async function signedInClient() {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

/** Starts a timed run; null for guests or if the leaderboard isn't set up. */
export async function startDriftRun(): Promise<string | null> {
  const supabase = await signedInClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("start_drift_run");
  if (error) { console.warn("start_drift_run failed", error.message); return null; }
  return typeof data === "string" ? data : null;
}

export async function submitDriftScore(runId: string, score: number): Promise<SubmitResult> {
  const supabase = await signedInClient();
  if (!supabase) return "guest";
  const { data, error } = await supabase.rpc("submit_drift_score", { p_run: runId, p_score: score });
  if (error) { console.warn("submit_drift_score failed", error.message); return "error"; }
  return data === "new-best" || data === "saved" ? data : "rejected";
}

export async function getDriftLeaderboard(limit = 10): Promise<Leaderboard | null> {
  const supabase = await signedInClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_drift_leaderboard", { p_limit: limit });
  if (error) { console.warn("get_drift_leaderboard failed", error.message); return null; }
  return data as Leaderboard;
}
