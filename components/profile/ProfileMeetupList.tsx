import Link from "next/link";
import { ArrowRight, CalendarDays } from "lucide-react";
import type { ReactNode } from "react";
import { categories } from "@/components/feed/categories";
import type { ProfileHistoryMeetup } from "@/lib/profile-history";

const dateFormat = new Intl.DateTimeFormat("en-CA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Toronto",
});

type ProfileMeetupListProps = {
  title: string;
  icon: typeof CalendarDays;
  meetups: (ProfileHistoryMeetup & { attendee_count?: number })[];
  empty: ReactNode;
  historyRole?: "Host" | "Participant";
};

export function ProfileMeetupList({ title, icon: Icon, meetups, empty, historyRole }: ProfileMeetupListProps) {
  return (
    <section className="min-w-0 rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden="true" size={17} className="text-red-800" />
        {title} <span className="text-sm font-normal text-stone-500">({meetups.length})</span>
      </h3>
      {meetups.length === 0 ? (
        <div className="mt-2 text-sm text-stone-600">{empty}</div>
      ) : (
        <ul className="mt-3 divide-y divide-stone-100">
          {meetups.map((meetup) => (
            <li key={meetup.id}>
              <Link href={`/meetups/${encodeURIComponent(meetup.id)}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg py-2 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-red-700">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="block font-semibold">{meetup.title}</span>
                  {historyRole && (
                    <span className="my-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-stone-700">
                      <span>{categories[meetup.category].label}</span>
                      <span>{historyRole}</span>
                      <span className={`rounded-full px-2 py-0.5 ${meetup.status === "cancelled" ? "bg-red-100 text-red-900" : "bg-stone-100"}`}>
                        {meetup.status === "cancelled" ? "Cancelled" : "Past"}
                      </span>
                    </span>
                  )}
                  <span className="block text-xs text-stone-600">
                    <time dateTime={meetup.starts_at}>{dateFormat.format(new Date(meetup.starts_at))}</time> · {meetup.location_name}
                    {!historyRole && meetup.attendee_count !== undefined && ` · ${meetup.attendee_count} going`}
                  </span>
                </span>
                <ArrowRight aria-hidden="true" size={16} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
