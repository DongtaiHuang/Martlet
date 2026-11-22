"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowUpRight, GraduationCap, Heart, MapPin, UsersRound } from "lucide-react";
import { FlapButton } from "@/components/social/FlapButton";
import { PeckButton } from "@/components/social/PeckButton";
import type { MeetupSummary } from "@/types/meetup";
import { categories } from "./categories";

export type MeetupCardProps = {
  meetup: MeetupSummary;
  /** Signed-in user's id (live mode). When null, counts are shown read-only (signed out or preview). */
  viewerId?: string | null;
};

const subscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "America/Toronto";

export function MeetupCard({ meetup, viewerId = null }: MeetupCardProps) {
  const { label, icon: CategoryIcon, color, accent } = categories[meetup.category];
  const labelColor = color.split(" ").filter((c) => c.startsWith("text-") || c.startsWith("dark:text-")).join(" ");
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, serverTimeZone);
  const starts = new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(meetup.starts_at));
  const isHost = viewerId !== null && viewerId === meetup.host_id;
  const joined = !isHost && meetup.has_pecked;
  const flapLabel = meetup.flap_count === 1 ? "flap" : "flaps";

  return (
    <article className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-t-4 bg-surface p-5 shadow-sm ${accent} ${joined ? "border-brand-line ring-2 ring-brand-soft" : "border-line"}`}>
      <p className={`eyebrow flex items-center gap-1.5 ${labelColor}`}>
        <CategoryIcon aria-hidden="true" size={14} />
        {label}
        <span aria-hidden="true" className="text-ink-subtle">·</span>
        <time dateTime={meetup.starts_at} className="text-ink-muted">{starts}</time>
      </p>
      <h3 className="mt-2 text-2xl leading-tight font-semibold text-ink [overflow-wrap:anywhere]">{meetup.title}</h3>
      <p className="mt-1.5 flex min-w-0 items-start gap-1.5 text-sm text-ink-muted [overflow-wrap:anywhere]">
        <MapPin aria-hidden="true" size={15} className="mt-0.5 shrink-0 text-ink-subtle" />
        <span>{meetup.location_name} <span className="text-ink-subtle">—</span> hosted by {meetup.host_display_name}</span>
      </p>
      {(meetup.course_code || isHost || joined) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {meetup.course_code && <span className="inline-flex items-center gap-1 rounded-md bg-brand-soft px-2 py-0.5 text-xs font-semibold text-brand-ink-strong ring-1 ring-brand-line"><GraduationCap aria-hidden="true" size={13} />{meetup.course_code}</span>}
          {isHost && <span className="rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-canvas">Hosting</span>}
          {joined && <span className="rounded-md bg-brand px-2 py-0.5 text-xs font-semibold text-on-brand">You’re going</span>}
        </div>
      )}
      <p className="mt-3 line-clamp-2 pb-4 text-[0.95rem] leading-6 text-ink-2 [overflow-wrap:anywhere]">{meetup.description}</p>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-line-soft pt-3">
        {viewerId ? (
          <div className="flex flex-wrap gap-2">
            <PeckButton meetupId={meetup.id} active={meetup.has_pecked} count={meetup.attendee_count} disabled={isHost} />
            <FlapButton meetupId={meetup.id} active={meetup.has_flapped} count={meetup.flap_count} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 text-xs font-medium text-ink-muted">
            <span className="inline-flex items-center gap-1"><UsersRound aria-hidden="true" size={15} />{meetup.attendee_count} going</span>
            <span className="inline-flex items-center gap-1"><Heart aria-hidden="true" size={15} />{meetup.flap_count} {flapLabel}</span>
          </div>
        )}
        <Link href={`/meetups/${encodeURIComponent(meetup.id)}`} aria-label={`View meetup: ${meetup.title}`} className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-bold text-brand-ink hover:underline focus-visible:outline-2 focus-visible:outline-focus">
          View meetup <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </article>
  );
}
