"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, GraduationCap, LayoutGrid } from "lucide-react";
import { mentionsAnyCourse } from "@/lib/course-codes";
import type { MeetupCategory, MeetupSummary } from "@/types/meetup";
import { categories, categoryValues } from "./categories";
import { MeetupCard } from "./MeetupCard";
import { Pagination, usePagination } from "./Pagination";

export function MeetupFeed({ meetups, viewerId = null, myCourses = [] }: { meetups: MeetupSummary[]; viewerId?: string | null; myCourses?: string[] }) {
  const [category, setCategory] = useState<MeetupCategory | "all">("all");
  const [onlyMyCourses, setOnlyMyCourses] = useState(true);
  // Study meetups for the student's courses: the meetup's course, or a course code in its title or description (issue #25).
  const courseFilter = category === "study" && myCourses.length > 0 && onlyMyCourses;
  const inCategory = category === "all" ? meetups : meetups.filter((meetup) => meetup.category === category);
  const visible = courseFilter ? inCategory.filter((meetup) => mentionsAnyCourse(`${meetup.course_code ?? ""} ${meetup.title} ${meetup.description}`, myCourses)) : inCategory;
  const { page, pageCount, pageItems, firstShown, lastShown, goToPage, resetPage, listTop } = usePagination(visible);

  function chooseCategory(value: MeetupCategory | "all") {
    setCategory(value);
    resetPage();
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
        <button type="button" aria-pressed={onlyMyCourses} onClick={() => { setOnlyMyCourses((on) => !on); resetPage(); }} className={`mb-4 inline-flex min-h-11 items-center gap-2 rounded-xl border px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 ${onlyMyCourses ? "border-red-800 bg-red-50 text-red-900" : "border-stone-200 bg-white text-stone-700 hover:border-red-300"}`}>
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
          <Pagination page={page} pageCount={pageCount} onChange={goToPage} label="Meetup pages" />
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

