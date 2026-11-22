"use client";

import Link from "next/link";
import { useState } from "react";
import { CalendarDays, LayoutGrid } from "lucide-react";
import type { MeetupCategory, MeetupSummary } from "@/types/meetup";
import { categories, categoryValues } from "./categories";
import { MeetupCard } from "./MeetupCard";

export function MeetupFeed({ meetups, viewerId = null }: { meetups: MeetupSummary[]; viewerId?: string | null }) {
  const [category, setCategory] = useState<MeetupCategory | "all">("all");
  const visible = category === "all" ? meetups : meetups.filter((meetup) => meetup.category === category);
  const filters = [
    { value: "all" as const, label: "All", icon: LayoutGrid },
    ...categoryValues.map((value) => ({ value, ...categories[value] })),
  ];

  return (
    <>
      <div role="group" aria-label="Filter by category" className="mt-4 mb-5 flex flex-wrap gap-2">
        {filters.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)} className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${category === value ? "border-brand bg-brand text-on-brand" : "border-line bg-surface text-ink-2 hover:border-brand-line hover:text-brand-ink-strong"}`}>
            <Icon aria-hidden="true" size={16} />
            {label}
          </button>
        ))}
      </div>
      <p role="status" className="mb-4 text-sm font-medium text-ink-muted">{visible.length} {visible.length === 1 ? "meetup" : "meetups"}{category === "all" ? "" : ` · ${categories[category].label}`}</p>
      {visible.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2">
          {visible.map((meetup) => <MeetupCard key={meetup.id} meetup={meetup} viewerId={viewerId} />)}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-10 text-center">
          <CalendarDays aria-hidden="true" className="mx-auto mb-3 text-brand-ink" />
          <h3 className="text-lg font-bold text-ink-soft">{category === "all" ? "No upcoming meetups" : `No ${categories[category].label.toLowerCase()} meetups yet`}</h3>
          <p className="mt-1 text-sm text-ink-muted">{category === "all" ? "Start something near campus." : "Try another category to see what’s happening."}</p>
          {category === "all" ? (
            <Link href="/meetups/new" className="mt-4 inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Create a meetup</Link>
          ) : (
            <button type="button" onClick={() => setCategory("all")} className="mt-4 min-h-11 rounded-lg px-3 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Clear filter</button>
          )}
        </div>
      )}
    </>
  );
}
