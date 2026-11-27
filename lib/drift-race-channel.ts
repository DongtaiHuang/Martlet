// The live part of a Drift race (ADR 0053): each car's position, about 10 times a second, over
// the room's private Realtime broadcast channel. Only the room's members can join it (RLS on
// realtime.messages, migration 037). Nothing here is stored. These are game cars on a game map,
// never anyone's real location (ADR 0008).
import { createClient } from "@/lib/supabase/client";
import { readPose, type RivalPose } from "./drift-race-pose.ts";

export type { RivalPose };

export type RaceChannel = { pose: (pose: RivalPose) => void; nudge: () => void; close: () => void };

/**
 * Joins a room's channel. `onPose` hears the other cars; `onNudge` hears "the room changed"
 * (someone joined, the host started, someone finished), so the page re-reads the room at once.
 */
export function openRaceChannel(code: string, onPose: (pose: RivalPose) => void, onNudge: () => void): RaceChannel {
  const supabase = createClient();
  let ready = false;
  const channel = supabase.channel(`drift-room:${code}`, { config: { private: true, broadcast: { self: false } } });
  channel
    .on("broadcast", { event: "pose" }, ({ payload }) => { const p = readPose(payload); if (p) onPose(p); })
    .on("broadcast", { event: "room" }, () => onNudge());
  void supabase.realtime.setAuth().then(() => channel.subscribe((status) => { ready = status === "SUBSCRIBED"; }));
  return {
    pose: (pose) => { if (ready) void channel.send({ type: "broadcast", event: "pose", payload: pose }); },
    nudge: () => { if (ready) void channel.send({ type: "broadcast", event: "room", payload: {} }); },
    close: () => { void supabase.removeChannel(channel); },
  };
}
