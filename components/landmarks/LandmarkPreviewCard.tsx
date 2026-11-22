import Link from "next/link";
import { ArrowUpRight, Camera, LockKeyhole, Star, UsersRound } from "lucide-react";
import type { LandmarkSummary } from "@/types/landmark";

/** Preview of a landmark for lists: name, challenge, and locked/unlocked state. */
export function LandmarkPreviewCard({ landmark }: { landmark: LandmarkSummary }) {
  const { unlocked } = landmark;
  return (
    <article className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-sm">
      <div
        aria-hidden="true"
        className={`flex h-24 items-center justify-center ${unlocked
          ? "bg-gradient-to-br from-amber-200 via-amber-300 to-orange-300 text-warn-ink dark:from-amber-900/70 dark:via-amber-800/60 dark:to-orange-900/70 dark:text-amber-100"
          : "bg-gradient-to-br from-stone-200 via-stone-300 to-stone-400 text-ink-muted dark:from-stone-800 dark:via-stone-700 dark:to-stone-600 dark:text-stone-300"}`}
      >
        {unlocked ? <Star size={36} fill="currentColor" /> : <LockKeyhole size={36} />}
      </div>
      <div className="flex flex-1 flex-col p-5">
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${unlocked ? "bg-warn-muted text-warn-ink" : "bg-surface-muted text-ink-2"}`}>
          {unlocked ? <Star aria-hidden="true" size={13} /> : <LockKeyhole aria-hidden="true" size={13} />}
          {unlocked ? "Unlocked" : "Locked"}
        </span>
        <h3 className="mt-3 text-xl font-bold leading-tight tracking-tight text-ink [overflow-wrap:anywhere]">{landmark.name}</h3>
        <p className="mt-2 flex gap-2 text-sm leading-6 text-ink-2">
          <Camera aria-hidden="true" size={16} className="mt-1 shrink-0 text-brand-ink" />
          <span>{landmark.challenge_prompt}</span>
        </p>
        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-line-soft pt-3">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-ink-muted">
            <UsersRound aria-hidden="true" size={15} />
            {landmark.unlock_count} {landmark.unlock_count === 1 ? "student" : "students"} unlocked
          </span>
          <Link href={`/landmarks/${encodeURIComponent(landmark.id)}`} aria-label={`View landmark: ${landmark.name}`} className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-bold text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-focus">
            {unlocked ? "View photos" : "View challenge"} <ArrowUpRight aria-hidden="true" size={15} />
          </Link>
        </div>
      </div>
    </article>
  );
}
