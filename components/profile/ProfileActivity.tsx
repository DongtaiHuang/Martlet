import Link from "next/link";
import { CalendarDays, UsersRound } from "lucide-react";
import { CompletedLandmarks } from "@/components/profile/CompletedLandmarks";
import { ProfileMeetupList } from "@/components/profile/ProfileMeetupList";
import { listLandmarks } from "@/lib/landmarks";
import { listMeetups } from "@/lib/meetups";
import { listProfileMeetupHistory, PROFILE_HISTORY_LIMIT } from "@/lib/profile-history";

const linkClass = "font-bold text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700";

export async function ProfileActivity({ viewerId }: { viewerId: string }) {
  const [upcoming, history, landmarks] = await Promise.allSettled([
    listMeetups(),
    listProfileMeetupHistory(),
    listLandmarks(),
  ]);

  return (
    <>
      <section aria-labelledby="activity-heading" className="mt-8">
        <h2 id="activity-heading" className="text-xl font-bold">Upcoming Meetups</h2>
        {upcoming.status === "fulfilled" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ProfileMeetupList title="Hosting" icon={CalendarDays} meetups={upcoming.value.filter((meetup) => meetup.host_id === viewerId)} empty={<>You’re not hosting anything upcoming. <Link href="/meetups/new" className={linkClass}>Create a meetup</Link></>} />
            <ProfileMeetupList title="Going" icon={UsersRound} meetups={upcoming.value.filter((meetup) => meetup.host_id !== viewerId && meetup.has_pecked)} empty={<>You haven’t joined any upcoming meetups. <Link href="/meetups" className={linkClass}>Find one to join</Link></>} />
          </div>
        ) : <p role="alert" className="mt-2 text-sm text-red-900">Couldn’t load upcoming meetups. Refresh to try again.</p>}
      </section>

      <section aria-labelledby="meetup-history-heading" className="mt-8">
        <h2 id="meetup-history-heading" className="text-xl font-bold">Meetup History</h2>
        <p className="mt-1 text-sm text-stone-600">Showing up to {PROFILE_HISTORY_LIMIT} recent meetups per role. Joined history includes meetups you still have a Peck for.</p>
        {history.status === "fulfilled" ? (
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <ProfileMeetupList title="Previously hosted" icon={CalendarDays} meetups={history.value.hosted} historyRole="Host" empty="You have no past or cancelled hosted meetups yet." />
            <ProfileMeetupList title="Previously joined" icon={UsersRound} meetups={history.value.joined} historyRole="Participant" empty="You have no past or cancelled joined meetups yet." />
          </div>
        ) : <p role="alert" className="mt-2 text-sm text-red-900">Couldn’t load meetup history. Refresh to try again.</p>}
      </section>

      <section aria-labelledby="completed-landmarks-heading" className="mt-8">
        <h2 id="completed-landmarks-heading" className="text-xl font-bold">Completed Landmarks</h2>
        {landmarks.status === "fulfilled"
          ? <CompletedLandmarks landmarks={landmarks.value} />
          : <p role="alert" className="mt-2 text-sm text-red-900">Couldn’t load your landmarks. Refresh to try again.</p>}
      </section>
    </>
  );
}
