"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { getAchievement, isAchievementId, type AchievementId } from "@/lib/achievement-catalog";
import { ACHIEVEMENT_EVENT, earn } from "./earn";

const SHOW_MS = 6000;
const KONAMI = ["ArrowUp", "ArrowUp", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowRight", "ArrowLeft", "ArrowRight", "b", "a"];

type Toast = { key: number; id: AchievementId; saved: boolean };

/**
 * Mounted once in the root layout. Shows an "Achievement unlocked" bar in the top-right
 * corner that disappears after a few seconds, and watches for the app-wide triggers
 * (secret key code, late-night visit, and any element marked data-achievement="<id>").
 */
export function AchievementToaster() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  useEffect(() => {
    let next = 0;
    const timers = new Set<ReturnType<typeof setTimeout>>();
    const onEarned = (event: Event) => {
      const { id, saved } = (event as CustomEvent<{ id: AchievementId; saved: boolean }>).detail;
      const key = ++next;
      setToasts((list) => [...list, { key, id, saved }]);
      const timer = setTimeout(() => {
        timers.delete(timer);
        setToasts((list) => list.filter((t) => t.key !== key));
      }, SHOW_MS);
      timers.add(timer);
    };

    let typed: string[] = [];
    const onKey = (event: KeyboardEvent) => {
      typed = [...typed, event.key.length === 1 ? event.key.toLowerCase() : event.key].slice(-KONAMI.length);
      if (typed.join() === KONAMI.join()) void earn("old-school");
    };

    // Hover or focus anything tagged data-achievement="<id>" (e.g. a photo on the tree).
    const onPoint = (event: Event) => {
      const id = (event.target as Element | null)?.closest?.("[data-achievement]")?.getAttribute("data-achievement");
      if (isAchievementId(id)) void earn(id);
    };

    const hour = new Date().getHours();
    if (hour >= 2 && hour < 5) void earn("night-owl");

    window.addEventListener(ACHIEVEMENT_EVENT, onEarned);
    window.addEventListener("keydown", onKey);
    document.addEventListener("pointerover", onPoint);
    document.addEventListener("focusin", onPoint);
    return () => {
      window.removeEventListener(ACHIEVEMENT_EVENT, onEarned);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerover", onPoint);
      document.removeEventListener("focusin", onPoint);
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed top-4 right-4 z-[1000] flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2"
    >
      {toasts.map((toast) => {
        const achievement = getAchievement(toast.id);
        return (
          <div
            key={toast.key}
            className="martlet-toast pointer-events-auto flex items-start gap-3 rounded-2xl border border-amber-300/60 bg-stone-900 p-3 text-white shadow-xl"
            style={{ animationDuration: `${SHOW_MS}ms` }}
          >
            <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-300/15 text-2xl">{achievement.icon}</span>
            <span className="min-w-0 flex-1">
              <span className="block text-[0.7rem] font-bold tracking-wider text-amber-300 uppercase">Achievement unlocked</span>
              <span className="block font-bold">{achievement.title}</span>
              <span className="block text-xs text-stone-300">{achievement.description}</span>
              {!toast.saved && <span className="mt-1 block text-[0.7rem] text-stone-400">Saved in this browser. Sign in to keep it on your profile.</span>}
            </span>
            <button
              type="button"
              aria-label="Dismiss"
              onClick={() => setToasts((list) => list.filter((t) => t.key !== toast.key))}
              className="-m-1 grid size-8 shrink-0 place-items-center rounded-lg text-stone-400 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-amber-300"
            >
              <X aria-hidden="true" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
