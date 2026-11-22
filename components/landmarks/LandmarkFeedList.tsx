"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Pagination, usePagination } from "@/components/feed/Pagination";
import type { LandmarkSummary } from "@/types/landmark";
import { LandmarkPreviewCard } from "./LandmarkPreviewCard";

/** The Landmarks view of the Meetups tab: six landmark cards per page. */
export function LandmarkFeedList({ landmarks }: { landmarks: LandmarkSummary[] }) {
  const { page, pageCount, pageItems, firstShown, lastShown, goToPage, listTop } = usePagination(landmarks);
  const unlocked = landmarks.filter((l) => l.unlocked).length;

  return (
    <>
      <div ref={listTop} className="mt-4 mb-5 flex scroll-mt-4 flex-wrap items-center justify-between gap-2">
        <p role="status" className="text-sm font-medium text-ink-muted">
          {landmarks.length} {landmarks.length === 1 ? "landmark" : "landmarks"} · {unlocked} unlocked
          {pageCount > 1 && ` · showing ${firstShown}–${lastShown}`}
        </p>
        <Link href="/landmarks" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">
          All landmarks <ArrowUpRight aria-hidden="true" size={16} />
        </Link>
      </div>
      {landmarks.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {pageItems.map((landmark) => <LandmarkPreviewCard key={landmark.id} landmark={landmark} />)}
          </div>
          <Pagination page={page} pageCount={pageCount} onChange={goToPage} label="Landmark pages" />
        </>
      ) : (
        <p className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-10 text-center text-ink-muted">No landmarks yet.</p>
      )}
    </>
  );
}
