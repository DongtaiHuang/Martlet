"use client";
import { useRef, useState } from "react";
import Link from "next/link";
import { LockKeyhole, Trophy, UserRound } from "lucide-react";
import { myAchievements } from "@/app/achievements/actions";
import { ACHIEVEMENTS, type EarnedMap } from "@/lib/achievement-catalog";
import { useEarned } from "@/components/achievements/useEarned";

/**
 * The Profile nav link. On larger screens, hovering or keyboard-focusing it opens a menu
 * with Profile, Achievements and the achievements still to unlock. Phones have no hover, so
 * tapping goes to the profile, which links to Achievements too.
 */
export function ProfileNavItem({ className, current }: { className: string; current?: "page" | "location" }) {
  const [account, setAccount] = useState<EarnedMap | null | undefined>(undefined);
  const loading = useRef(false);
  const earned = useEarned(account);

  // Load the user's achievements the first time the menu opens.
  const load = () => {
    if (loading.current) return;
    loading.current = true;
    myAchievements().then(setAccount, () => { loading.current = false; });
  };

  const done = ACHIEVEMENTS.filter((a) => earned[a.id]).length;
  const goals = ACHIEVEMENTS.filter((a) => !a.hidden && !earned[a.id]);
  const hiddenLeft = ACHIEVEMENTS.filter((a) => a.hidden && !earned[a.id]).length;
  const item = "flex min-h-10 items-center gap-2.5 rounded-lg px-3 text-sm font-semibold hover:bg-surface-muted focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus";

  return (
    <div className="group relative" onMouseEnter={load} onFocus={load}>
      <Link href="/profile" aria-current={current} className={className}>
        <UserRound aria-hidden="true" size={16} className="shrink-0" />
        Profile
      </Link>
      {/* pt-2 bridges the gap so the menu doesn't close while the pointer moves onto it. */}
      <div className="absolute top-full right-0 z-50 hidden w-72 pt-2 sm:group-hover:block sm:group-focus-within:block">
        <div className="rounded-2xl border border-line bg-surface p-2 text-ink-soft shadow-xl">
          <Link href="/profile" className={item}><UserRound aria-hidden="true" size={16} className="text-ink-muted" /> Your profile</Link>
          <Link href="/achievements" className={item}>
            <Trophy aria-hidden="true" size={16} className="text-amber-500" /> Achievements
            <span className="ml-auto text-xs font-bold text-ink-subtle">{account === undefined ? "" : `${done} / ${ACHIEVEMENTS.length}`}</span>
          </Link>
          {(goals.length > 0 || hiddenLeft > 0) && (
            <div className="mt-1 border-t border-line px-3 pt-2 pb-1">
              <p className="text-[0.7rem] font-bold tracking-wider text-ink-subtle uppercase">Still to unlock</p>
              <ul className="mt-1 space-y-1.5">
                {goals.map((a) => (
                  <li key={a.id} className="flex items-start gap-2 text-xs">
                    <span aria-hidden="true" className="grayscale">{a.icon}</span>
                    <span><span className="font-bold text-ink-2">{a.title}</span> <span className="text-ink-muted">· {a.description}</span></span>
                  </li>
                ))}
                {hiddenLeft > 0 && (
                  <li className="flex items-center gap-2 text-xs text-ink-muted">
                    <LockKeyhole aria-hidden="true" size={13} /> {hiddenLeft} hidden {hiddenLeft === 1 ? "achievement" : "achievements"} to find
                  </li>
                )}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
