import Link from "next/link";
import { LandmarkPreviewCard } from "@/components/landmarks/LandmarkPreviewCard";
import type { LandmarkSummary } from "@/types/landmark";

export function CompletedLandmarks({ landmarks }: { landmarks: LandmarkSummary[] }) {
  const completed = landmarks.filter((landmark) => landmark.unlocked);
  const total = landmarks.length;
  const percentage = total === 0 ? 0 : Math.round((completed.length / total) * 100);

  return (
    <>
      <div className="mt-3 rounded-2xl border border-line bg-surface p-5">
        <p id="landmark-profile-progress" className="text-sm font-semibold">
          {completed.length} of {total} landmarks unlocked · {percentage}%
        </p>
        <div role="progressbar" aria-labelledby="landmark-profile-progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percentage} className="mt-2 h-2.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-brand" style={{ width: `${percentage}%` }} />
        </div>
        {completed.length === 0 && <p className="mt-3 text-sm text-ink-muted">You haven’t unlocked any landmarks yet. Explore campus and complete your first challenge!</p>}
        <Link href="/landmarks" className="mt-2 inline-flex min-h-11 items-center rounded-lg text-sm font-bold text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-focus">Explore landmarks</Link>
      </div>
      {completed.length > 0 && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {completed.map((landmark) => <LandmarkPreviewCard key={landmark.id} landmark={landmark} />)}
        </div>
      )}
    </>
  );
}
