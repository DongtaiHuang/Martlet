"use client";

import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { ArrowUpRight, CalendarDays, Heart, MapPin, UsersRound } from "lucide-react";
import type { MeetupSummary } from "@/types/meetup";
import { categories } from "./categories";

export type MeetupCardProps = {
  meetup: MeetupSummary;
  onPeck?: (id: string) => Promise<void>;
  onFlap?: (id: string) => Promise<void>;
};

const subscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "America/Toronto";

export function MeetupCard({ meetup, onPeck, onFlap }: MeetupCardProps) {
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
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function reactToMeetup(callback: (id: string) => Promise<void>) {
    setPending(true);
    setError("");
    try {
      await callback(meetup.id);
    } catch {
      setError("Couldn’t update your reaction. Try again.");
    } finally {
      setPending(false);
    }
  }

  const reactions = [
    { label: "Peck", count: meetup.attendee_count, suffix: "going", icon: UsersRound, pressed: meetup.has_pecked, callback: onPeck },
    { label: "Flap", count: meetup.flap_count, suffix: "flaps", icon: Heart, pressed: meetup.has_flapped, callback: onFlap },
  ];

  return (
    <article className={`flex min-w-0 flex-col overflow-hidden rounded-2xl border border-stone-200 border-t-4 bg-white p-5 shadow-sm ${accent}`}>
      <div className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${color}`}>
        <CategoryIcon aria-hidden="true" size={15} />
        {label}
      </div>
      <h3 className="mt-4 text-xl font-bold leading-tight tracking-tight text-stone-950 [overflow-wrap:anywhere]">{meetup.title}</h3>
      <p className="mt-1 text-sm text-stone-600 [overflow-wrap:anywhere]">Hosted by {meetup.host_display_name}</p>
      <p className="mt-3 line-clamp-2 text-sm leading-6 text-stone-700 [overflow-wrap:anywhere]">{meetup.description}</p>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 pb-4 text-sm text-stone-700">
        <span className="inline-flex items-center gap-2"><CalendarDays aria-hidden="true" size={16} className="shrink-0 text-stone-500" /><time dateTime={meetup.starts_at}>{starts}</time></span>
        <span className="inline-flex min-w-0 items-center gap-2 [overflow-wrap:anywhere]"><MapPin aria-hidden="true" size={16} className="shrink-0 text-stone-500" />{meetup.location_name}</span>
      </div>
      <div className="mt-auto flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t border-stone-100 pt-2">
        <div className="flex flex-wrap items-center gap-x-3 text-xs font-medium text-stone-600">
          {reactions.map(({ label, count, suffix, icon: Icon, pressed, callback }) =>
            callback ? (
              <button key={label} type="button" aria-pressed={pressed} aria-label={`${label}, ${count} ${suffix}`} disabled={pending} onClick={() => void reactToMeetup(callback)} className="inline-flex min-h-11 items-center gap-1 rounded-md px-1 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-60 aria-pressed:text-red-800">
                <Icon aria-hidden="true" size={15} />{count} {suffix}
              </button>
            ) : (
              <span key={label} className="inline-flex items-center gap-1"><Icon aria-hidden="true" size={15} />{count} {suffix}</span>
            ),
          )}
        </div>
        <Link href={`/meetups/${encodeURIComponent(meetup.id)}`} aria-label={`View meetup: ${meetup.title}`} className="inline-flex min-h-11 items-center gap-1 rounded-md text-sm font-bold text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700">
          View meetup <ArrowUpRight aria-hidden="true" size={15} />
        </Link>
      </div>
      {error && <p role="alert" className="text-sm text-red-800">{error}</p>}
    </article>
  );
}
