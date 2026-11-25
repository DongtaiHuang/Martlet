"use server";

import { getDriftLeaderboard, startDriftRun, submitDriftScore, type Leaderboard, type SubmitResult } from "@/lib/drift-scores";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startDriftRunAction(): Promise<string | null> {
  return startDriftRun().catch(() => null);
}

export async function submitDriftScoreAction(runId: unknown, score: unknown): Promise<SubmitResult> {
  if (typeof runId !== "string" || !UUID.test(runId) || !Number.isInteger(score)) return "rejected";
  return submitDriftScore(runId, score as number).catch(() => "error" as const);
}

export async function driftLeaderboardAction(limit = 10): Promise<Leaderboard | null> {
  return getDriftLeaderboard(Math.min(Math.max(Math.trunc(limit) || 10, 1), 50)).catch(() => null);
}
