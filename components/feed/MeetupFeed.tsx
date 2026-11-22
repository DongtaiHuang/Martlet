"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, GraduationCap, LayoutGrid } from "lucide-react";
import { mentionsAnyCourse } from "@/lib/course-codes";
import type { MeetupCategory, MeetupSummary } from "@/types/meetup";
import { categories, categoryValues } from "./categories";
import { MeetupCard } from "./MeetupCard";

const PAGE_SIZE = 6;

export function MeetupFeed({ meetups, viewerId = null, myCourses = [] }: { meetups: MeetupSummary[]; viewerId?: string | null; myCourses?: string[] }) {
  const [category, setCategory] = useState<MeetupCategory | "all">("all");
  const [onlyMyCourses, setOnlyMyCourses] = useState(true);
  const [page, setPage] = useState(0);
  const listTop = useRef<HTMLParagraphElement>(null);
  // Study meetups for the student's courses: the meetup's course, or a course code in its title or description (issue #25).
  const courseFilter = category === "study" && myCourses.length > 0 && onlyMyCourses;
  const inCategory = category === "all" ? meetups : meetups.filter((meetup) => meetup.category === category);
  const visible = courseFilter ? inCategory.filter((meetup) => mentionsAnyCourse(`${meetup.course_code ?? ""} ${meetup.title} ${meetup.description}`, myCourses)) : inCategory;
  const pageCount = Math.max(1, Math.ceil(visible.length / PAGE_SIZE));
  // Clamp in case the list got shorter (e.g. a meetup started) while on a later page.
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = visible.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);
  const firstShown = currentPage * PAGE_SIZE + 1;
  const lastShown = currentPage * PAGE_SIZE + pageItems.length;

  function chooseCategory(value: MeetupCategory | "all") {
    setCategory(value);
    setPage(0);
  }

  function goToPage(next: number) {
    setPage(next);
    // Bring the top of the list back into view, so the new page starts at the first card.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    listTop.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }

  const filters = [
    { value: "all" as const, label: "All", icon: LayoutGrid },
    ...categoryValues.map((value) => ({ value, ...categories[value] })),
  ];

  return (
    <>
      <div role="group" aria-label="Filter by category" className="mt-4 mb-5 flex flex-wrap gap-2">
        {filters.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" aria-pressed={category === value} onClick={() => chooseCategory(value)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${category === value ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink-2 hover:border-brand-line hover:text-brand-ink-strong"}`}>
            <Icon aria-hidden="true" size={16} />
            {label}
          </button>
        ))}
      </div>
      {category === "study" && myCourses.length > 0 && (
        <button type="button" aria-pressed={onlyMyCourses} onClick={() => { setOnlyMyCourses((on) => !on); setPage(0); }} className={`mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${onlyMyCourses ? "border-red-800 bg-red-50 text-red-900" : "border-stone-200 bg-white text-stone-700 hover:border-red-300"}`}>
          <GraduationCap aria-hidden="true" size={16} />
          My courses only ({myCourses.join(", ")})
        </button>
      )}
      <p ref={listTop} role="status" className="mb-4 scroll-mt-4 text-sm font-medium text-stone-600">{visible.length} {visible.length === 1 ? "meetup" : "meetups"}{category === "all" ? "" : ` · ${categories[category].label}`}{courseFilter ? " · my courses" : ""}{pageCount > 1 ? ` · showing ${firstShown}–${lastShown}` : ""}</p>
      {visible.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            {pageItems.map((meetup) => <MeetupCard key={meetup.id} meetup={meetup} viewerId={viewerId} />)}
          </div>
          {pageCount > 1 && <Pagination page={currentPage} pageCount={pageCount} onChange={goToPage} />}
        </>
      ) : (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-white px-5 py-10 text-center">
          <CalendarDays aria-hidden="true" className="mx-auto mb-3 text-red-800" />
          <h3 className="text-lg font-bold text-stone-900">{courseFilter ? "No study meetups for your courses yet" : category === "all" ? "No upcoming meetups" : `No ${categories[category].label.toLowerCase()} meetups yet`}</h3>
          <p className="mt-1 text-sm text-stone-600">{courseFilter ? "Start one and pick your course, so classmates find it." : category === "all" ? "Start something near campus." : "Try another category to see what’s happening."}</p>
          {category === "all" ? (
            <Link href="/meetups/new" className="mt-4 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Create a meetup</Link>
          ) : (
            <button type="button" onClick={() => chooseCategory("all")} className="mt-4 min-h-11 rounded-lg px-3 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Clear filter</button>
          )}
        </div>
      )}
    </>
  );
}

/** Page indexes to show as buttons: first, last, and the current page ±1, with gaps as null ("…"). */
function visiblePages(page: number, pageCount: number): (number | null)[] {
  const shown = [...new Set([0, page - 1, page, page + 1, pageCount - 1])]
    .filter((index) => index >= 0 && index < pageCount)
    .sort((a, b) => a - b);
  return shown.flatMap((index, i) => {
    const gap = i > 0 ? index - shown[i - 1] - 1 : 0;
    // Show a single missing page as its number; only longer gaps become "…".
    return gap === 0 ? [index] : gap === 1 ? [index - 1, index] : [null, index];
  });
}

function Pagination({ page, pageCount, onChange }: { page: number; pageCount: number; onChange: (page: number) => void }) {
  const button = "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40";
  const idle = "border-line bg-surface text-ink-2 hover:border-brand-line hover:text-brand-ink-strong";

  return (
    <nav aria-label="Meetup pages" className="mt-6 flex flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 0} className={`${button} ${idle}`}>
        <ChevronLeft aria-hidden="true" size={18} /> Previous
      </button>
      {/* Numbered pages on wider screens; phones get "Page 2 of 4" so the row never wraps awkwardly. */}
      <ol className="hidden items-center gap-2 sm:flex">
        {visiblePages(page, pageCount).map((index, i) => index === null ? (
          <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted">…</li>
        ) : (
          <li key={index}>
            <button
              type="button" onClick={() => onChange(index)} aria-current={index === page ? "page" : undefined}
              aria-label={`Page ${index + 1}`}
              className={`${button} ${index === page ? "border-brand bg-brand text-on-brand" : idle}`}
            >
              {index + 1}
            </button>
          </li>
        ))}
      </ol>
      <span className="px-1 text-sm font-medium text-ink-muted sm:hidden">Page {page + 1} of {pageCount}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page === pageCount - 1} className={`${button} ${idle}`}>
        Next <ChevronRight aria-hidden="true" size={18} />
      </button>
    </nav>
  );
}
