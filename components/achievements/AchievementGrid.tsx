"use client";
import { LockKeyhole } from "lucide-react";
import { ACHIEVEMENTS, type Achievement, type EarnedMap } from "@/lib/achievement-catalog";
import type { ActivityProgress } from "@/lib/activity-achievements";
import { useEarned } from "./useEarned";
import { AchievementIcon } from "./AchievementIcon";

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

function Card({ achievement: a, at, progress }: { achievement: Achievement; at?: string; progress?: { current: number; target: number } }) {
  const secret = a.hidden && !at;
  return (
    <li className={`flex items-start gap-3 rounded-2xl border p-4 ${at ? "border-amber-300 bg-warn-soft dark:border-amber-300/50" : "border-line bg-surface"}`}>
      <span
        aria-hidden="true"
        className={`grid size-12 shrink-0 place-items-center rounded-xl text-2xl ${at ? "bg-amber-200/60 dark:bg-amber-300/20" : "bg-surface-muted text-ink-subtle grayscale"}`}
      >
        {secret ? <LockKeyhole size={20} /> : <AchievementIcon achievement={a} />}
      </span>
      <span className="min-w-0">
        <span className={`block font-bold ${at ? "text-ink-soft" : "text-ink-2"}`}>{secret ? "???" : a.title}</span>
        <span className="block text-sm text-ink-muted">{secret ? "Hidden achievement. Keep poking around." : a.description}</span>
        <span className="mt-1 block text-xs font-semibold text-ink-subtle">{at ? `Unlocked ${dateFormat.format(new Date(at))}` : progress ? `${progress.current}/${progress.target}` : "Not yet"}</span>
      </span>
    </li>
  );
}

/**
 * All achievements in two lists: still to unlock (goals first, hidden ones last), then
 * unlocked. `earned` comes from the account; null (signed out or demo mode) uses the ones
 * saved in this browser. Updates live when a new one is earned on this page.
 */
export function AchievementGrid({ earned: account, progress }: { earned: EarnedMap | null; progress?: ActivityProgress }) {
  const earned = useEarned(account);
  const todo = ACHIEVEMENTS.filter((a) => !earned[a.id]).sort((a, b) => Number(a.hidden) - Number(b.hidden));
  const done = ACHIEVEMENTS.filter((a) => earned[a.id]);

  return (
    <>
      <p className="text-sm font-semibold text-ink-2">{done.length} of {ACHIEVEMENTS.length} unlocked</p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(done.length / ACHIEVEMENTS.length) * 100}%` }} />
      </div>

      {todo.length > 0 && (
        <section aria-labelledby="todo-heading" className="mt-8">
          <h2 id="todo-heading" className="text-lg font-bold">Still to unlock <span className="font-semibold text-ink-subtle">({todo.length})</span></h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {todo.map((a) => <Card key={a.id} achievement={a} progress={progress?.[a.id]} />)}
          </ul>
        </section>
      )}

      <section aria-labelledby="done-heading" className="mt-8">
        <h2 id="done-heading" className="text-lg font-bold">Unlocked <span className="font-semibold text-ink-subtle">({done.length})</span></h2>
        {done.length === 0 ? (
          <p className="mt-2 text-sm text-ink-muted">Nothing yet. Try hovering over a martlet on the map.</p>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {done.map((a) => <Card key={a.id} achievement={a} at={earned[a.id]} />)}
          </ul>
        )}
      </section>
    </>
  );
}
