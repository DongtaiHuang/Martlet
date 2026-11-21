import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, MapPin, UserRound } from "lucide-react";
import { categories } from "@/components/feed/categories";
import { CancelMeetupForm } from "@/components/forms/CancelMeetupForm";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { MartletNav } from "@/components/layout/MartletNav";
import { exploreMeetupHref } from "@/components/map/explore-link";
import { MeetupLocationMap } from "@/components/map/MeetupLocationMap";
import { FlapButton } from "@/components/social/FlapButton";
import { PeckButton } from "@/components/social/PeckButton";
import { getMeetup } from "@/lib/meetups";
import { MeetupReactions } from "./MeetupReactions";
import { MeetupStartTime } from "./MeetupStartTime";

export const dynamic = "force-dynamic";

async function loadMeetup(id: string) {
  const meetup = await getMeetup(id);
  if (!meetup) notFound();
  const viewer = await getMeetupViewer();
  const cancelled = meetup.status === "cancelled";
  const expired = Date.parse(meetup.starts_at) <= Date.now();
  const upcoming = !cancelled && !expired;
  const isHost = viewer === meetup.host_id;
  return { meetup, cancelled, expired, upcoming, isHost, canCancel: upcoming && isHost, canReact: upcoming && viewer !== null };
}

export default async function MeetupDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { meetup, cancelled, expired, upcoming, isHost, canCancel, canReact } = await loadMeetup(id);
  const { icon: CategoryIcon, label, color } = categories[meetup.category];

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/meetups" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-red-800 hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Back to feed</Link>
        <article className="mt-3 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
          <div className="flex flex-wrap gap-2">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${color}`}><CategoryIcon aria-hidden="true" size={15} /> {label}</span>
            {cancelled && <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-900">Cancelled</span>}
            {!cancelled && expired && <span className="rounded-full bg-stone-200 px-3 py-1 text-xs font-semibold text-stone-800">Past meetup</span>}
          </div>
          <h1 className="mt-3 text-3xl font-extrabold tracking-tight [overflow-wrap:anywhere] sm:text-4xl">{meetup.title}</h1>
          {cancelled && <p className="mt-3 text-sm text-red-900">The host cancelled this meetup.</p>}
          {!cancelled && expired && <p className="mt-3 text-sm text-stone-600">This meetup’s start time has passed.</p>}
          <dl className="mt-5 grid gap-4 rounded-xl bg-stone-50 p-4 [overflow-wrap:anywhere]">
            <div><dt className="relative pl-7 text-sm font-bold"><UserRound aria-hidden="true" size={18} className="absolute top-0 left-0 text-red-800" />Host</dt><dd className="pl-7 text-sm text-stone-700">{meetup.host_display_name}</dd></div>
            <div><dt className="relative pl-7 text-sm font-bold"><CalendarDays aria-hidden="true" size={18} className="absolute top-0 left-0 text-red-800" />Starts</dt><dd className="pl-7 text-sm text-stone-700"><MeetupStartTime startsAt={meetup.starts_at} /></dd></div>
            <div><dt className="relative pl-7 text-sm font-bold"><MapPin aria-hidden="true" size={18} className="absolute top-0 left-0 text-red-800" />Campus location</dt><dd className="pl-7 text-sm text-stone-700">
              {/* Explore only lists upcoming meetups, so only link to it while this one is upcoming. */}
              {upcoming ? (
                <Link href={exploreMeetupHref(meetup.id)} className="font-semibold text-red-800 underline decoration-red-300 underline-offset-2 hover:decoration-red-800 focus-visible:outline-2 focus-visible:outline-red-700">
                  {meetup.location_name}<span className="sr-only">, view on the campus map</span>
                </Link>
              ) : meetup.location_name}
            </dd></div>
          </dl>
          <section aria-label="Meetup location" className="mt-4">
            <MeetupLocationMap
              category={meetup.category}
              locationName={meetup.location_name}
              latitude={meetup.latitude}
              longitude={meetup.longitude}
            />
            {upcoming && (
              <Link href={exploreMeetupHref(meetup.id)} className="mt-2 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700">
                <MapPin aria-hidden="true" size={15} /> See nearby meetups on the campus map
              </Link>
            )}
          </section>
          {meetup.description && (
            <section aria-labelledby="description-heading" className="mt-6">
              <h2 id="description-heading" className="text-lg font-bold">About this meetup</h2>
              <p className="mt-1 leading-7 whitespace-pre-wrap text-stone-700 [overflow-wrap:anywhere]">{meetup.description}</p>
            </section>
          )}
          {/* Developer 4's Peck/Flap controls. The host is already counted as going and RLS rejects host pecks. */}
          <MeetupReactions
            meetup={meetup}
            canReact={canReact}
            actions={
              <div className="flex flex-wrap gap-2">
                <PeckButton meetupId={meetup.id} active={meetup.has_pecked} count={meetup.attendee_count} disabled={isHost} />
                <FlapButton meetupId={meetup.id} active={meetup.has_flapped} count={meetup.flap_count} />
              </div>
            }
          />
          {canCancel && <div className="mt-6"><CancelMeetupForm meetupId={meetup.id} /></div>}
        </article>
      </main>
    </div>
  );
}
