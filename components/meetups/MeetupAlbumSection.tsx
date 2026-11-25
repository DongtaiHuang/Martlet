import { Images } from "lucide-react";
import { ALBUM_DAYS, albumClosesAt, albumState, timeLeft } from "@/lib/meetup-album";
import { getMeetupAlbum } from "@/lib/meetup-photos";
import { MeetupAlbum } from "./MeetupAlbum";

type Meetup = { id: string; host_id: string; title: string; starts_at: string; status: string };

function loadClock(meetup: Meetup) {
  const now = Date.now();
  const closesAt = albumClosesAt(meetup.starts_at);
  return { state: albumState(meetup, now), closesIn: timeLeft(closesAt, now), closesAt };
}

/** The shared photo album (issue #117, ADR 0039). Only the host and people going see it. */
export async function MeetupAlbumSection({ meetup }: { meetup: Meetup }) {
  const album = await getMeetupAlbum(meetup).catch((error) => {
    console.error("Album failed to load", error);
    return null;
  });
  if (!album) return null;
  const { state, closesIn, closesAt } = loadClock(meetup);
  if (state === "closed") return null; // nobody can see a closed album's photos

  const closesOn = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" }).format(closesAt);

  return (
    <section aria-labelledby="album-heading" className="mt-6 border-t border-line pt-6">
      <h2 id="album-heading" className="flex items-center gap-2 text-lg font-bold"><Images aria-hidden="true" size={19} className="text-brand-ink" /> Photo album</h2>
      {state === "not-started" ? (
        <p className="mt-1 text-sm text-ink-muted">Once the meetup starts, everyone going can share photos here. Only the host and people going can see them, and they’re deleted {ALBUM_DAYS} days after the start.</p>
      ) : (
        <>
          <p className="mt-1 text-sm text-ink-muted">
            Only the host and people going can see these. Photos are deleted <strong className="font-semibold text-ink-2">{closesIn}</strong> ({closesOn}), so download the ones you want to keep.
          </p>
          <MeetupAlbum meetupId={meetup.id} meetupTitle={meetup.title} photos={album.photos} myCount={album.myCount} />
        </>
      )}
    </section>
  );
}
