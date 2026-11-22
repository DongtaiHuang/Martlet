"use client";

import dynamic from "next/dynamic";
import { useState, useSyncExternalStore } from "react";
import { Camera, Check, CircleStop, Lock, Play, Video } from "lucide-react";
import type { Clip } from "@/components/avatar3d/face";
import { useFaceTracker } from "@/components/avatar3d/useFaceTracker";
import { ITEMS, PLUMAGES, pinCount, total, type ItemId, type PlumageId, type Progress } from "./items";

// Three.js and the bird only load in the browser, on this page.
const Martlet3D = dynamic(() => import("@/components/avatar3d/Martlet3D"), {
  ssr: false,
  loading: () => <div className="grid aspect-square w-full max-w-[520px] place-items-center rounded-3xl bg-stone-100"><p role="status" className="text-sm text-stone-600">Hatching your martlet…</p></div>,
});

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

export function AvatarStudio({ progress, name }: { progress: Progress; name: string }) {
  const unlockedItems = ITEMS.filter((i) => i.unlocked(progress));
  const [wearing, setWearing] = useState<Set<ItemId>>(() => new Set(unlockedItems.filter((i) => i.slot !== "hat").map((i) => i.id)));
  const [plumageId, setPlumageId] = useState<PlumageId>("classic");
  const [clip, setClip] = useState<Clip | null>(null);
  const [playId, setPlayId] = useState(0);
  const reduced = useSyncExternalStore(subscribeMotion, getMotion, () => false);
  const tracker = useFaceTracker();
  const tracking = tracker.status === "live" || tracker.status === "recording";
  const plumage = PLUMAGES.find((p) => p.id === plumageId)!;

  function toggle(id: ItemId) {
    const item = ITEMS.find((i) => i.id === id)!;
    setWearing((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else {
        if (item.slot === "hat") ITEMS.filter((i) => i.slot === "hat").forEach((i) => next.delete(i.id)); // one hat at a time
        next.add(id);
      }
      return next;
    });
  }

  async function recordClip() {
    const c = await tracker.record();
    if (c.frames.length >= 5) setClip(c);
  }

  const chip = (on: boolean, locked: boolean) =>
    `inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-red-700 ${locked ? "cursor-not-allowed border-dashed border-stone-300 bg-stone-50 text-stone-500" : on ? "border-red-800 bg-red-800 text-white" : "border-stone-300 bg-white text-stone-800 hover:border-red-700"}`;
  const btn = "inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-50";

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex min-w-0 flex-col items-center rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <Martlet3D
          name={name} plumage={plumage} wearing={wearing} pins={pinCount(progress)}
          live={tracker.faceRef} tracking={tracking} clip={clip} playId={playId} animate={!reduced}
        />
        <p className="mt-2 text-sm text-stone-600">{name} · {total(progress)} achievements</p>
      </div>

      <div className="min-w-0 space-y-6">
        <section aria-labelledby="face-heading">
          <h2 id="face-heading" className="font-bold">Animate with my face</h2>
          <p className="mt-1 text-sm text-stone-600">Your martlet copies your blinks, smile, mouth, brows and head turns. Sit back so your shoulders and elbows are in view, then raise your arms to flap its wings.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {!tracking ? (
              <button type="button" disabled={tracker.status === "loading"} onClick={() => void tracker.start()} className={`${btn} bg-red-800 text-white hover:bg-red-900`}>
                <Camera aria-hidden="true" size={16} /> {tracker.status === "loading" ? "Starting…" : "Start camera"}
              </button>
            ) : (
              <>
                <button type="button" disabled={tracker.status === "recording"} onClick={() => void recordClip()} className={`${btn} bg-red-800 text-white hover:bg-red-900`}>
                  <Video aria-hidden="true" size={16} /> {tracker.status === "recording" ? `Recording ${tracker.clipSeconds}s…` : "Record expression"}
                </button>
                <button type="button" disabled={tracker.status === "recording"} onClick={tracker.stop} className={`${btn} border border-stone-300 bg-white text-stone-800`}>
                  <CircleStop aria-hidden="true" size={16} /> Stop camera
                </button>
              </>
            )}
            {clip && !tracking && (
              <button type="button" onClick={() => setPlayId((n) => n + 1)} className={`${btn} border border-stone-300 bg-white text-stone-800 hover:border-red-700`}>
                <Play aria-hidden="true" size={16} /> Play my clip
              </button>
            )}
          </div>
          <p role="status" className="mt-2 min-h-5 text-sm text-stone-700">
            {tracker.status === "live" && "Tracking: try winking, smiling, frowning, puffing your cheeks, sticking your tongue out, or moving your arms up, forward and back."}
            {tracker.status === "recording" && "Recording… do your best expression!"}
            {clip && tracker.status === "idle" && `Clip saved in this tab: ${clip.frames.length} expression samples (numbers only).`}
          </p>
          {tracker.error && <p role="alert" className="text-sm text-red-800">{tracker.error}</p>}
          <p className="mt-1 text-xs text-stone-500">Runs in your browser. The video is never uploaded or stored; a clip is just expression numbers, kept in this tab for the prototype.</p>
        </section>

        <section aria-labelledby="gear-heading">
          <h2 id="gear-heading" className="font-bold">Accessories</h2>
          <div className="mt-2 grid gap-2">
            {ITEMS.map((item) => {
              const locked = !item.unlocked(progress), on = wearing.has(item.id);
              return (
                <button key={item.id} type="button" disabled={locked} aria-pressed={on} onClick={() => toggle(item.id)} className={chip(on, locked)}>
                  {locked ? <Lock aria-hidden="true" size={15} /> : on ? <Check aria-hidden="true" size={15} /> : <span className="size-[15px]" />}
                  <span className="font-semibold">{item.label}</span>
                  {locked && <span className="ml-auto text-xs">{item.requirement}</span>}
                </button>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="plumage-heading">
          <h2 id="plumage-heading" className="font-bold">Plumage</h2>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {PLUMAGES.map((p) => {
              const locked = !p.unlocked(progress), on = plumageId === p.id;
              return (
                <button key={p.id} type="button" disabled={locked} aria-pressed={on} onClick={() => setPlumageId(p.id)} className={chip(on, locked)} title={locked ? p.requirement : undefined}>
                  <span className="size-4 shrink-0 rounded-full border border-white/60" style={{ background: p.body }} />
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.label}</span>
                    {locked && <span className="block text-xs">{p.requirement}</span>}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <p className="text-xs text-stone-500">Landmark pins: {pinCount(progress)} of 5 · Hosted {progress.hosted} · Joined {progress.joined} · Landmarks {progress.landmarks}</p>
      </div>
    </div>
  );
}
