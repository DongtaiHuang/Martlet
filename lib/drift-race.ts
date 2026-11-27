// Martlet Drift live races (ADR 0053): thin wrappers over the migration 037 functions. Rooms, seats
// and results live in the database; user ids come from the session.
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";
import type { TrackId } from "@/lib/drift-tracks";

export type RaceStatus = "lobby" | "countdown" | "racing" | "done";
export type RacePlayer = { seat: number; name: string; me: boolean; host: boolean; score: number | null; finished: boolean };
export type RaceRoom = {
  code: string; track: TrackId; host: boolean; status: RaceStatus;
  starts_at: string | null; server_now: string; players: RacePlayer[];
};
export type RaceFinish = "saved" | "rejected" | "late" | "error";

export class RaceError extends Error {}

function raceError(error: { message: string; hint?: string; code?: string }): never {
  if (error.hint === "full") throw new RaceError("That race is full (4 drivers).");
  if (error.hint === "started") throw new RaceError("That race has already started.");
  if (error.hint === "alone") throw new RaceError("Wait for at least one friend to join.");
  if (error.hint === "blocked") throw new RaceError("You can’t join this race.");
  if (error.hint === "racing") throw new RaceError("Wait for the race to finish.");
  if (error.hint === "rate-limit") throw new RaceError("You’ve opened a lot of rooms. Try again later.");
  if (error.code === "P0002") throw new RaceError("No race with that code. Check it and try again.");
  if (error.code === "42501") throw new RaceError("Only the host can do that.");
  throw new Error(error.message);
}

async function client() {
  if (getDataMode() !== "live") throw new RaceError("Sign in to race your friends.");
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims?.sub) throw new RaceError("Sign in to race your friends.");
  return supabase;
}

async function call(fn: string, args: Record<string, unknown> = {}): Promise<RaceRoom | null> {
  const { data, error } = await (await client()).rpc(fn, args);
  if (error) raceError(error);
  return (data ?? null) as RaceRoom | null;
}

export const getRaceRoom = () => call("get_drift_room");
export const createRaceRoom = (track: TrackId) => call("create_drift_room", { p_track: track });
export const joinRaceRoom = (code: string) => call("join_drift_room", { p_code: code });
export const startRaceRoom = () => call("start_drift_room");
export const rematchRaceRoom = (track: TrackId) => call("rematch_drift_room", { p_track: track });

export async function leaveRaceRoom(): Promise<void> {
  const { error } = await (await client()).rpc("leave_drift_room");
  if (error) raceError(error);
}

export async function finishRace(score: number, path: number[]): Promise<RaceFinish> {
  const { data, error } = await (await client()).rpc("finish_drift_race", { p_score: score, p_path: path });
  if (error) { console.warn("finish_drift_race failed", error.message); return "error"; }
  return data as RaceFinish;
}
