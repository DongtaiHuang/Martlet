"use server";

import { getDriftGhosts, getDriftLeaderboard, startDriftRun, submitDriftRun, submitDriftScore, type Leaderboard, type SubmitResult } from "@/lib/drift-scores";
import type { Ghost } from "@/lib/drift-ghost";

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

const SMALLINT = (v: unknown) => Number.isInteger(v) && Math.abs(v as number) <= 32767;

/** A run with its replay (ADR 0050). The server re-checks timing, score and the path itself. */
export async function submitDriftRunAction(runId: unknown, score: unknown, paint: unknown, path: unknown): Promise<SubmitResult> {
  if (typeof runId !== "string" || !UUID.test(runId) || !Number.isInteger(score) || !Number.isInteger(paint)) return "rejected";
  const replay = Array.isArray(path) && path.length >= 40 && path.length <= 4000 && path.length % 4 === 0 && path.every(SMALLINT) ? (path as number[]) : null;
  if (!replay) return submitDriftScore(runId, score as number).catch(() => "error" as const);
  return submitDriftRun(runId, score as number, paint as number, replay).catch(() => "error" as const);
}

export async function driftGhostsAction(): Promise<Ghost[]> {
  return getDriftGhosts().catch(() => []);
}
