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
    <section className="min-w-0 rounded-2xl border border-line bg-surface p-5">
      <h3 className="flex items-center gap-2 font-semibold">
        <Icon aria-hidden="true" size={17} className="text-brand-ink" />
        {title} <span className="text-sm font-normal text-ink-subtle">({meetups.length})</span>
      </h3>
      {meetups.length === 0 ? (
        <div className="mt-2 text-sm text-ink-muted">{empty}</div>
      ) : (
        <ul className="mt-3 divide-y divide-line-soft">
          {meetups.map((meetup) => (
            <li key={meetup.id}>
              <Link href={`/meetups/${encodeURIComponent(meetup.id)}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg py-2 hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus">
                <span className="min-w-0 [overflow-wrap:anywhere]">
                  <span className="block font-semibold">{meetup.title}</span>
                  {historyRole && (
                    <span className="my-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-ink-2">
                      <span>{categories[meetup.category].label}</span>
                      <span>{historyRole}</span>
                      <span className={`rounded-full px-2 py-0.5 ${meetup.status === "cancelled" ? "bg-brand-muted text-brand-ink-strong" : "bg-surface-muted"}`}>
                        {meetup.status === "cancelled" ? "Cancelled" : "Past"}
                      </span>
                    </span>
                  )}
                  <span className="block text-xs text-ink-muted">
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
