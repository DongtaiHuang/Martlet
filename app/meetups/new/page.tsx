import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MeetupForm } from "@/components/forms/MeetupForm";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { MartletNav } from "@/components/layout/MartletNav";
import { getDataMode } from "@/lib/supabase/env";

export const dynamic = "force-dynamic";

export default async function CreateMeetupPage() {
  const viewer = await getMeetupViewer();
  const isMockMode = getDataMode() === "mock";

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/meetups" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-red-800 hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Back to feed</Link>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Create a meetup</h1>
        <p className="mt-2 text-stone-600">Give students a place and time to meet you on campus.</p>
        {!viewer && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            {isMockMode ? (
              <p>Demo mode: the form is available to preview, but publishing needs a configured Supabase project. Ask your team to follow <code>docs/SUPABASE_SETUP.md</code>, then restart the app.</p>
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <p className="flex-1">Sign in to publish your meetup.</p>
                <Link href="/login?next=%2Fmeetups%2Fnew" className="rounded-lg bg-red-800 px-3 py-2 font-semibold text-white hover:bg-red-900">Sign in</Link>
                <Link href="/signup?next=%2Fmeetups%2Fnew" className="font-semibold text-red-800 underline">Create account</Link>
              </div>
            )}
          </div>
        )}
        <div className="mt-5"><MeetupForm /></div>
      </main>
    </div>
  );
}
