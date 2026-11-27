"use server";

import { getDriftGhosts, getDriftLeaderboard, startDriftRun, submitDriftRun, submitDriftScore, type Leaderboard, type SubmitResult } from "@/lib/drift-scores";
import type { Ghost } from "@/lib/drift-ghost";
import { isTrackId } from "@/lib/drift-tracks";
import {
  createRaceRoom, finishRace, getRaceRoom, joinRaceRoom, leaveRaceRoom, RaceError, rematchRaceRoom, startRaceRoom,
  type RaceFinish, type RaceRoom,
} from "@/lib/drift-race";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function startDriftRunAction(track: unknown = "streets"): Promise<string | null> {
  return startDriftRun(isTrackId(track) ? track : "streets").catch(() => null);
}

export async function submitDriftScoreAction(runId: unknown, score: unknown): Promise<SubmitResult> {
  if (typeof runId !== "string" || !UUID.test(runId) || !Number.isInteger(score)) return "rejected";
  return submitDriftScore(runId, score as number).catch(() => "error" as const);
}

export async function driftLeaderboardAction(limit = 10, track: unknown = "streets"): Promise<Leaderboard | null> {
  return getDriftLeaderboard(Math.min(Math.max(Math.trunc(limit) || 10, 1), 50), isTrackId(track) ? track : "streets").catch(() => null);
}

const SMALLINT = (v: unknown) => Number.isInteger(v) && Math.abs(v as number) <= 32767;

/** A run with its replay (ADR 0050). The server re-checks timing, score and the path itself. */
export async function submitDriftRunAction(runId: unknown, score: unknown, paint: unknown, path: unknown): Promise<SubmitResult> {
  if (typeof runId !== "string" || !UUID.test(runId) || !Number.isInteger(score) || !Number.isInteger(paint)) return "rejected";
  const replay = Array.isArray(path) && path.length >= 40 && path.length <= 4000 && path.length % 4 === 0 && path.every(SMALLINT) ? (path as number[]) : null;
  if (!replay) return submitDriftScore(runId, score as number).catch(() => "error" as const);
  return submitDriftRun(runId, score as number, paint as number, replay).catch(() => "error" as const);
}

export async function driftGhostsAction(track: unknown = "streets"): Promise<Ghost[]> {
  return getDriftGhosts(5, isTrackId(track) ? track : "streets").catch(() => []);
}

// Live races with friends (ADR 0053) ------------------------------------------------------------
type RaceReply = { room: RaceRoom | null; error?: string };
const ROOM_CODE = /^[A-HJ-NP-Z2-9]{6}$/;

async function raceReply(work: () => Promise<RaceRoom | null>): Promise<RaceReply> {
  try {
    return { room: await work() };
  } catch (error) {
    if (error instanceof RaceError) return { room: null, error: error.message };
    console.error("Drift race failed", error);
    return { room: null, error: "Something went wrong. Try again." };
  }
}

export async function raceRoomAction(): Promise<RaceReply> { return raceReply(getRaceRoom); }
export async function createRaceAction(track: unknown): Promise<RaceReply> {
  return raceReply(() => createRaceRoom(isTrackId(track) ? track : "streets"));
}
export async function joinRaceAction(code: unknown): Promise<RaceReply> {
  const c = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!ROOM_CODE.test(c)) return { room: null, error: "Race codes are 6 letters and numbers." };
  return raceReply(() => joinRaceRoom(c));
}
export async function startRaceAction(): Promise<RaceReply> { return raceReply(startRaceRoom); }
export async function rematchRaceAction(track: unknown): Promise<RaceReply> {
  return raceReply(() => rematchRaceRoom(isTrackId(track) ? track : "streets"));
}
export async function leaveRaceAction(): Promise<RaceReply> {
  return raceReply(async () => { await leaveRaceRoom(); return null; });
}
/** Your race result with its replay; the server checks the timing and the path (ADR 0050). */
export async function finishRaceAction(score: unknown, path: unknown): Promise<RaceFinish> {
  if (!Number.isInteger(score) || !Array.isArray(path) || path.length > 4000 || !path.every(SMALLINT)) return "rejected";
  return finishRace(score as number, path as number[]).catch(() => "error" as const);
}
