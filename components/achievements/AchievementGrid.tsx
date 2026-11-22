"use client";
import { useMemo, useSyncExternalStore } from "react";
import { LockKeyhole } from "lucide-react";
import { ACHIEVEMENTS, isAchievementId, type EarnedMap } from "@/lib/achievement-catalog";
import { guestSnapshot, sessionSnapshot, subscribeEarned } from "./earn";

function parse(raw: string): EarnedMap {
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object") return {};
    return Object.fromEntries(Object.entries(value).filter(([id, at]) => isAchievementId(id) && typeof at === "string"));
  } catch {
    return {};
  }
}

const dateFormat = new Intl.DateTimeFormat("en-CA", { dateStyle: "medium" });

/**
 * All achievements, earned first. `earned` comes from the account; when it's null (signed
 * out or demo mode) the ones saved in this browser are shown instead. Updates live when a
 * new one is earned on this page.
 */
export function AchievementGrid({ earned }: { earned: EarnedMap | null }) {
  const guest = earned === null;
  const raw = useSyncExternalStore(subscribeEarned, guest ? guestSnapshot : sessionSnapshot, () => "{}");
  const all = useMemo(() => ({ ...parse(raw), ...earned }), [raw, earned]);
  const count = ACHIEVEMENTS.filter((a) => all[a.id]).length;
  const sorted = [...ACHIEVEMENTS].sort((a, b) => Number(!all[a.id]) - Number(!all[b.id]));

  return (
    <section aria-labelledby="achievements-count">
      <p id="achievements-count" className="text-sm font-semibold text-ink-2">
        {count} of {ACHIEVEMENTS.length} unlocked
      </p>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-line" aria-hidden="true">
        <div className="h-full rounded-full bg-amber-400" style={{ width: `${(count / ACHIEVEMENTS.length) * 100}%` }} />
      </div>
      <ul className="mt-5 grid gap-3 sm:grid-cols-2">
        {sorted.map((a) => {
          const at = all[a.id];
          const secret = a.hidden && !at;
          return (
            <li
              key={a.id}
              className={`flex items-start gap-3 rounded-2xl border p-4 ${at ? "border-amber-300 bg-warn-soft dark:border-amber-300/50" : "border-line bg-surface"}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-12 shrink-0 place-items-center rounded-xl text-2xl ${at ? "bg-amber-200/60 dark:bg-amber-300/20" : "bg-surface-muted text-ink-subtle grayscale"}`}
              >
                {secret ? <LockKeyhole size={20} /> : a.icon}
              </span>
              <span className="min-w-0">
                <span className={`block font-bold ${at ? "text-ink-soft" : "text-ink-subtle"}`}>{secret ? "???" : a.title}</span>
                <span className="block text-sm text-ink-muted">
                  {secret ? "Hidden achievement. Keep poking around." : a.description}
                </span>
                <span className="mt-1 block text-xs font-semibold text-ink-subtle">
                  {at ? `Unlocked ${dateFormat.format(new Date(at))}` : "Locked"}
                </span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
