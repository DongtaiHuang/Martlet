"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { ArrowUpRight, CalendarDays, Heart, MapPin, UsersRound } from "lucide-react";
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
    <article className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-t-4 bg-white p-5 shadow-sm ${accent} ${joined ? "border-red-300 ring-2 ring-red-100" : "border-stone-200"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
          <CategoryIcon aria-hidden="true" size={15} />
          {label}
        </span>
        {isHost && <span className="rounded-full bg-stone-900 px-2.5 py-1 text-xs font-semibold text-white">Hosting</span>}
        {joined && <span className="rounded-full bg-red-800 px-2.5 py-1 text-xs font-semibold text-white">You’re going</span>}
      </div>
      <h3 className="mt-4 text-xl font-bold leading-tight tracking-tight text-stone-950 [overflow-wrap:anywhere]">{meetup.title}</h3>
      <p className="mt-1 text-sm text-stone-600 [overflow-wrap:anywhere]">Hosted by {meetup.host_display_name}</p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-stone-700 [overflow-wrap:anywhere]">{meetup.description}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 pb-4 text-sm text-stone-700">
        <span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" size={16} className="shrink-0 text-stone-500" /><time dateTime={meetup.starts_at}>{starts}</time></span>
        <span className="inline-flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]"><MapPin aria-hidden="true" size={16} className="shrink-0 text-stone-500" />{meetup.location_name}</span>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-stone-100 pt-3">
        {viewerId ? (
          <div className="flex flex-wrap gap-2">
            <PeckButton meetupId={meetup.id} active={meetup.has_pecked} count={meetup.attendee_count} disabled={isHost} />
            <FlapButton meetupId={meetup.id} active={meetup.has_flapped} count={meetup.flap_count} />
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-x-3 text-xs font-medium text-stone-600">
            <span className="inline-flex items-center gap-1"><UsersRound aria-hidden="true" size={15} />{meetup.attendee_count} going</span>
            <span className="inline-flex items-center gap-1"><Heart aria-hidden="true" size={15} />{meetup.flap_count} {flapLabel}</span>
          </div>
        )}
        <Link href={`/meetups/${encodeURIComponent(meetup.id)}`} aria-label={`View meetup: ${meetup.title}`} className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-bold text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700">
          View meetup <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
    </article>
  );
}
