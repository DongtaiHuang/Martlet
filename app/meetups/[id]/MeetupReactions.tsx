import type { ReactNode } from "react";
import { Heart, UsersRound } from "lucide-react";
import type { MeetupSummary } from "@/types/meetup";

export function MeetupReactions({ meetup, canReact, actions }: { meetup: MeetupSummary; canReact: boolean; actions?: ReactNode }) {
  return (
    <section aria-label="Meetup reactions" className="mt-6 border-t border-stone-200 pt-5">
      <div className="flex flex-wrap gap-2 text-sm font-semibold text-stone-700">
        <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-2"><UsersRound aria-hidden="true" size={17} /> {meetup.attendee_count} going</span>
        <span className="inline-flex items-center gap-2 rounded-full bg-stone-100 px-3 py-2"><Heart aria-hidden="true" size={17} /> {meetup.flap_count} {meetup.flap_count === 1 ? "flap" : "flaps"}</span>
      </div>
      {canReact && actions && <div className="mt-4">{actions}</div>}
    </section>
  );
}
