import Link from "next/link";
import { CalendarDays, Landmark } from "lucide-react";

export type FeedView = "meetups" | "landmarks";

const OPTIONS = [
  { view: "meetups" as const, href: "/meetups", label: "Upcoming meetups", icon: CalendarDays },
  { view: "landmarks" as const, href: "/meetups?view=landmarks", label: "Landmarks", icon: Landmark },
];

/** "Upcoming meetups / Landmarks" switch. The choice lives in the URL (?view=landmarks). */
export function FeedViewToggle({ view }: { view: FeedView }) {
  return (
    <nav aria-label="Choose what the feed shows" className="inline-flex w-full max-w-md rounded-2xl border border-line bg-surface p-1 shadow-sm sm:w-auto">
      {OPTIONS.map(({ view: option, href, label, icon: Icon }) => {
        const active = option === view;
        return (
          <Link
            key={option}
            href={href}
            scroll={false}
            aria-current={active ? "page" : undefined}
            className={`inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl px-3 text-sm max-[359px]:px-2 font-bold whitespace-nowrap focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:flex-none sm:text-base ${active ? "bg-brand text-on-brand shadow-sm" : "text-ink-muted hover:bg-surface-muted hover:text-ink-soft"}`}
          >
            <Icon aria-hidden="true" size={17} className="max-[359px]:hidden" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
