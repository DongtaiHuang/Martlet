"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Check, Lock } from "lucide-react";
import { FaceLoop } from "./FaceLoop";
import { ITEMS, PLUMAGES, pinCount, total, type ItemId, type PlumageId, type Progress } from "./items";
import { MartletAvatar } from "./MartletAvatar";

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const PING_PONG = [0, 1, 2, 1];

export function AvatarStudio({ progress, name }: { progress: Progress; name: string }) {
  const unlockedItems = ITEMS.filter((i) => i.unlocked(progress));
  const [wearing, setWearing] = useState<Set<ItemId>>(() => new Set(unlockedItems.filter((i) => i.slot !== "hat").map((i) => i.id)));
  const [plumageId, setPlumageId] = useState<PlumageId>("classic");
  const [frames, setFrames] = useState<string[]>([]);
  const [tick, setTick] = useState(0);
  const reduced = useSyncExternalStore(subscribeMotion, getMotion, () => false);

  useEffect(() => {
    if (frames.length !== 3 || reduced) return;
    const id = setInterval(() => setTick((t) => t + 1), 220);
    return () => clearInterval(id);
  }, [frames.length, reduced]);

  const plumage = PLUMAGES.find((p) => p.id === plumageId)!;
  const frame = frames.length === 3 ? frames[reduced ? 1 : PING_PONG[tick % PING_PONG.length]] : null;

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

  const chip = (on: boolean, locked: boolean) =>
    `inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-sm focus-visible:outline-2 focus-visible:outline-red-700 ${locked ? "cursor-not-allowed border-dashed border-stone-300 bg-stone-50 text-stone-500" : on ? "border-red-800 bg-red-800 text-white" : "border-stone-300 bg-white text-stone-800 hover:border-red-700"}`;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)]">
      <div className="flex flex-col items-center rounded-3xl border border-stone-200 bg-white p-4 shadow-sm">
        <MartletAvatar
          plumage={plumage} wearing={wearing} pins={pinCount(progress)} size={460} title={`${name}’s martlet`}
          medallion={frame ? <image href={frame} x={416} y={162} width={104} height={104} preserveAspectRatio="xMidYMid slice" /> : undefined}
        />
        <p className="mt-2 text-sm text-stone-600">{name} · {total(progress)} achievements</p>
      </div>

      <div className="space-y-6">
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

        <section aria-labelledby="loop-heading">
          <h2 id="loop-heading" className="font-bold">Face loop</h2>
          <p className="mt-1 text-sm text-stone-600">Three quick frames that play in the medallion next to your martlet. Optional.</p>
          <div className="mt-2"><FaceLoop frames={frames} onFrames={setFrames} /></div>
        </section>

        <p className="text-xs text-stone-500">Landmark pins: {pinCount(progress)} of 5 · Hosted {progress.hosted} · Joined {progress.joined} · Landmarks {progress.landmarks}</p>
      </div>
    </div>
  );
}
