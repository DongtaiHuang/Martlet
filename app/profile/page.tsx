import Link from "next/link";
import { ArrowRight, CalendarDays, LogIn, UserRound, UsersRound } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { listMeetups } from "@/lib/meetups";
import { getCurrentUser, type CurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import type { MeetupSummary } from "@/types/meetup";

export const dynamic = "force-dynamic";

type ProfileState =
  | { kind: "preview" }
  | { kind: "signed-out" }
  | { kind: "error" }
  | { kind: "ready"; user: CurrentUser; hosted: MeetupSummary[]; joined: MeetupSummary[] };

async function loadProfile(): Promise<ProfileState> {
  if (getDataMode() === "mock") return { kind: "preview" };
  try {
    const user = await getCurrentUser();
    if (!user) return { kind: "signed-out" };
    // listMeetups() returns upcoming open meetups only, so both lists are "upcoming".
    const meetups = await listMeetups();
    return {
      kind: "ready",
      user,
      hosted: meetups.filter((m) => m.host_id === user.id),
      joined: meetups.filter((m) => m.host_id !== user.id && m.has_pecked),
    };
  } catch (error) {
    console.error("Failed to load the student profile", error);
    return { kind: "error" };
  }
}

const dateFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

function MeetupList({ title, icon: Icon, meetups, empty }: { title: string; icon: typeof CalendarDays; meetups: MeetupSummary[]; empty: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-stone-200 bg-white p-5">
      <h3 className="flex items-center gap-2 font-semibold"><Icon aria-hidden="true" size={17} className="text-red-800" /> {title} <span className="text-sm font-normal text-stone-500">({meetups.length})</span></h3>
      {meetups.length === 0 ? (
        <div className="mt-2 text-sm text-stone-600">{empty}</div>
      ) : (
        <ul className="mt-3 divide-y divide-stone-100">
          {meetups.map((m) => (
            <li key={m.id}>
              <Link href={`/meetups/${encodeURIComponent(m.id)}`} className="flex min-h-11 items-center justify-between gap-3 rounded-lg py-2 hover:text-red-800 focus-visible:outline-2 focus-visible:outline-red-700">
                <span className="min-w-0">
                  <span className="block font-semibold [overflow-wrap:anywhere]">{m.title}</span>
                  <span className="block text-xs text-stone-600"><time dateTime={m.starts_at}>{dateFormat.format(new Date(m.starts_at))}</time> · {m.location_name} · {m.attendee_count} going</span>
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

export default async function ProfilePage() {
  const state = await loadProfile();
  const linkClass = "font-bold text-red-800 hover:underline focus-visible:outline-2 focus-visible:outline-red-700";

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Student profile</h1>
        <div className="mt-5 rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="flex items-center gap-4">
            <div className="grid size-14 shrink-0 place-items-center rounded-2xl bg-red-100 text-red-900"><UserRound aria-hidden="true" size={24} /></div>
            <div className="min-w-0">
              {state.kind === "ready" ? (
                <>
                  <h2 className="text-xl font-bold [overflow-wrap:anywhere]">{state.user.display_name}</h2>
                  {state.user.email && <p className="mt-1 text-sm text-stone-600 [overflow-wrap:anywhere]">Signed in as {state.user.email}</p>}
                </>
              ) : state.kind === "signed-out" ? (
                <>
                  <h2 className="text-xl font-bold">You’re signed out</h2>
                  <p className="mt-1 text-sm text-stone-600">Sign in to see the meetups you host and join.</p>
                </>
              ) : state.kind === "preview" ? (
                <>
                  <h2 className="text-xl font-bold">Preview mode</h2>
                  <p className="mt-1 text-sm text-stone-600">Student accounts need Supabase. See <code>docs/SUPABASE_SETUP.md</code>.</p>
                </>
              ) : (
                <>
                  <h2 className="text-xl font-bold">Profile unavailable</h2>
                  <p role="alert" className="mt-1 text-sm text-stone-600">Couldn’t load your profile. Refresh the page to try again.</p>
                </>
              )}
            </div>
          </div>
          {state.kind === "signed-out" ? (
            <Link href="/login?next=/profile" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-800 px-4 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700"><LogIn aria-hidden="true" size={16} /> Sign in</Link>
          ) : (
            <Link href="/meetups" className={`mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm ${linkClass}`}>Browse meetups <ArrowRight aria-hidden="true" size={16} /></Link>
          )}
        </div>

        {state.kind === "ready" && (
          <section aria-labelledby="activity-heading" className="mt-8">
            <h2 id="activity-heading" className="text-xl font-bold">Your upcoming meetups</h2>
            <p className="mt-1 text-sm text-stone-600">Open meetups that haven’t started yet. Past and cancelled meetups aren’t listed.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <MeetupList title="Hosting" icon={CalendarDays} meetups={state.hosted} empty={<>You’re not hosting anything upcoming. <Link href="/meetups/new" className={linkClass}>Create a meetup</Link></>} />
              <MeetupList title="Going" icon={UsersRound} meetups={state.joined} empty={<>You haven’t joined any upcoming meetups. <Link href="/meetups" className={linkClass}>Find one to join</Link></>} />
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
