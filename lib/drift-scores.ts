// Martlet Drift leaderboard (ADR 0037): thin wrappers over the migration 022 functions.
// Scores are checked server-side against each run's start time; user ids come from the session.
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { Leaderboard, SubmitResult } from "@/lib/flight-scores";
import { ghostChoices, type Ghost } from "@/lib/drift-ghost";
import type { TrackId } from "@/lib/drift-tracks";

export type { Leaderboard, SubmitResult } from "@/lib/flight-scores";

async function signedInClient() {
  if (getDataMode() === "mock") return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  return data?.claims?.sub ? supabase : null;
}

/** Starts a timed run; null for guests or if the leaderboard isn't set up. */
export async function startDriftRun(track: TrackId = "streets"): Promise<string | null> {
  const supabase = await signedInClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("start_drift_run", { p_track: track });
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

export async function getDriftLeaderboard(limit = 10, track: TrackId = "streets"): Promise<Leaderboard | null> {
  const supabase = await signedInClient();
  if (!supabase) return null;
  const { data, error } = await supabase.rpc("get_drift_leaderboard", { p_limit: limit, p_track: track });
  if (error) { console.warn("get_drift_leaderboard failed", error.message); return null; }
  return data as Leaderboard;
}

/** Submits a run with its replay (migration 034): a new best also becomes your ghost. */
export async function submitDriftRun(runId: string, score: number, paint: number, path: number[]): Promise<SubmitResult> {
  const supabase = await signedInClient();
  if (!supabase) return "guest";
  const { data, error } = await supabase.rpc("submit_drift_run", { p_run: runId, p_score: score, p_paint: paint, p_path: path });
  if (error) { console.warn("submit_drift_run failed", error.message); return "error"; }
  return data === "new-best" || data === "saved" ? data : "rejected";
}

/** The best ghosts plus your own, best first. Empty for guests. */
export async function getDriftGhosts(limit = 5, track: TrackId = "streets"): Promise<Ghost[]> {
  const supabase = await signedInClient();
  if (!supabase) return [];
  const [top, mine] = await Promise.all([
    supabase.rpc("get_drift_ghosts", { p_limit: limit, p_track: track }),
    supabase.rpc("get_my_drift_ghost", { p_track: track }),
  ]);
  if (top.error) { console.warn("get_drift_ghosts failed", top.error.message); return []; }
  return ghostChoices((top.data ?? []) as Ghost[], (mine.data ?? null) as Ghost | null);
}
