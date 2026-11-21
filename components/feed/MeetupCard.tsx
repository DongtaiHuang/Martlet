import Link from "next/link";
import type { MeetupSummary } from "@/types/meetup";

export function MeetupCard({ meetup }: { meetup: MeetupSummary }) {
  const starts = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "medium", timeStyle: "short", timeZone: "America/Toronto"
  }).format(new Date(meetup.starts_at));

  return (
    <article className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-neutral-500">
        <span className="rounded-full bg-red-50 px-3 py-1 capitalize text-red-800">{meetup.category}</span>
        <time dateTime={meetup.starts_at}>{starts}</time>
      </div>
      <h2 className="mt-3 text-xl font-semibold text-neutral-900">{meetup.title}</h2>
      <p className="mt-1 text-sm text-neutral-500">Hosted by {meetup.host_display_name} · {meetup.location_name}</p>
      <p className="mt-3 line-clamp-2 text-sm text-neutral-700">{meetup.description}</p>
      <div className="mt-4 flex items-center justify-between gap-3 text-sm text-neutral-600">
        <span>🐦 {meetup.attendee_count} going · ❤️ {meetup.flap_count} flaps</span>
        <Link href={`/meetups/${meetup.id}`} className="rounded-lg bg-red-700 px-3 py-2 font-semibold text-white hover:bg-red-800">
          View meetup
        </Link>
      </div>
    </article>
  );
}
