"use server";

import { getFlightLeaderboard, startFlightRun, submitFlightScore, type Leaderboard, type SubmitResult } from "@/lib/flight-scores";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startRunAction(): Promise<string | null> {
  return startFlightRun().catch(() => null);
}

export async function submitScoreAction(runId: unknown, score: unknown): Promise<SubmitResult> {
  if (typeof runId !== "string" || !UUID.test(runId) || !Number.isInteger(score)) return "rejected";
  return submitFlightScore(runId, score as number).catch(() => "error" as const);
}

export async function leaderboardAction(limit = 10): Promise<Leaderboard | null> {
  return getFlightLeaderboard(Math.min(Math.max(Math.trunc(limit) || 10, 1), 50)).catch(() => null);
}
