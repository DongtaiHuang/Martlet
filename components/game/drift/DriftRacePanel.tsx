"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Copy, Flag, LogOut, Users } from "lucide-react";
import { TRACK_IDS, TRACKS, type TrackId } from "@/lib/drift-tracks";
import type { RaceRoom } from "@/lib/drift-race";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Race friends (ADR 0053): open a room, share its code, and up to 4 of you drive at once. */
export function DriftRacePanel({ signedIn, room, error, busy, track, onCreate, onJoin, onLeave, onStart, onTrack }: {
  signedIn: boolean; room: RaceRoom | null; error: string | null; busy: boolean; track: TrackId;
  onCreate: () => void; onJoin: (code: string) => void; onLeave: () => void; onStart: () => void; onTrack: (t: TrackId) => void;
}) {
  const [code, setCode] = useState("");
  const [copied, setCopied] = useState(false);

  return (
    <section aria-labelledby="race-heading" className="mt-6 rounded-2xl border border-line bg-surface p-4 shadow-sm sm:p-5">
      <h2 id="race-heading" className="flex items-center gap-2 text-lg font-bold text-ink"><Users aria-hidden="true" size={18} className="text-brand-ink" /> Race your friends</h2>
      {!signedIn ? (
        <p className="mt-2 text-sm text-ink-muted"><Link href="/login?next=%2Fplay%2Fdrift" className="font-semibold text-brand-ink underline">Sign in</Link> to race up to 3 friends live.</p>
      ) : !room ? (
        <>
          <p className="mt-1 text-sm text-ink-muted">Up to 4 drivers on the same track at the same time. Most drift points after 90 seconds wins.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <button type="button" disabled={busy} onClick={onCreate}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 ${focus}`}>
              <Flag aria-hidden="true" size={16} /> Open a race on the {TRACKS[track].name.toLowerCase()}
            </button>
            <form className="flex items-end gap-2" onSubmit={(e) => { e.preventDefault(); onJoin(code); }}>
              <label className="text-sm font-semibold">Have a code?
                <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 6))}
                  inputMode="text" autoCapitalize="characters" autoComplete="off" spellCheck={false} placeholder="ABC234"
                  className="mt-1 block w-32 rounded-xl border border-line-strong bg-surface px-3 py-2 font-mono text-base tracking-widest uppercase" />
              </label>
              <button type="submit" disabled={busy || code.length !== 6}
                className={`inline-flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-bold hover:border-brand disabled:opacity-60 ${focus}`}>Join</button>
            </form>
          </div>
        </>
      ) : (
        <>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-sm text-ink-muted">Race code</p>
            <p className="font-mono text-2xl font-black tracking-[0.3em] text-ink">{room.code}</p>
            <button type="button" onClick={() => { void navigator.clipboard?.writeText(room.code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
              className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-strong px-3 text-sm font-bold hover:border-brand ${focus}`}>
              {copied ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="mt-1 text-sm text-ink-muted">Send the code to your friends. They join from this page.</p>

          <ol className="mt-3 grid gap-2 sm:grid-cols-4" aria-label="Drivers">
            {[1, 2, 3, 4].map((seat) => {
              const p = room.players.find((x) => x.seat === seat);
              return (
                <li key={seat} className={`rounded-xl border px-3 py-2 text-sm ${p ? "border-line-strong" : "border-dashed border-line text-ink-muted"}`}>
                  {p ? <><span className="font-bold [overflow-wrap:anywhere]">{p.name}</span>{p.me && " (you)"}{p.host && <span className="block text-xs text-ink-muted">Host</span>}</> : "Open seat"}
                </li>
              );
            })}
          </ol>

          {room.status === "lobby" && (
            <fieldset className="mt-3" disabled={!room.host || busy}>
              <legend className="text-sm font-bold">Track {room.host ? "" : "(the host picks)"}</legend>
              <div className="mt-1 flex flex-wrap gap-2">
                {TRACK_IDS.map((id) => (
                  <label key={id} className="cursor-pointer">
                    <input type="radio" name="race-track" className="peer sr-only" checked={room.track === id} onChange={() => onTrack(id)} />
                    <span className="inline-flex min-h-11 items-center rounded-full border border-line-strong px-3 text-sm font-semibold peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-focus">{TRACKS[id].name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {room.host && room.status === "lobby" && (
              <button type="button" disabled={busy || room.players.length < 2} onClick={onStart}
                className={`inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 ${focus}`}>
                <Flag aria-hidden="true" size={16} /> {room.players.length < 2 ? "Waiting for a friend…" : "Start the race"}
              </button>
            )}
            {!room.host && room.status === "lobby" && <p className="self-center text-sm font-semibold text-ink-2">Waiting for the host to start…</p>}
            <button type="button" disabled={busy || room.status === "countdown" || room.status === "racing"} onClick={onLeave}
              className={`inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong px-4 text-sm font-bold hover:border-brand disabled:opacity-60 ${focus}`}>
              <LogOut aria-hidden="true" size={16} /> Leave
            </button>
          </div>
        </>
      )}
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-brand-ink">{error}</p>}
    </section>
  );
}
