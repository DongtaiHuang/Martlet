import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { MeetupForm } from "@/components/forms/MeetupForm";
import { getMeetupViewer } from "@/components/forms/meetup-viewer";
import { MartletNav } from "@/components/layout/MartletNav";

export const dynamic = "force-dynamic";

export default async function CreateMeetupPage() {
  const viewer = await getMeetupViewer();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-950">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <Link href="/meetups" className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-red-800 hover:underline"><ArrowLeft aria-hidden="true" size={16} /> Back to feed</Link>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">Create a meetup</h1>
        <p className="mt-2 text-stone-600">Give students a place and time to meet you on campus.</p>
        {!viewer && <p className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950">You can preview the form. A signed-in student account is required to publish.</p>}
        <div className="mt-5"><MeetupForm /></div>
      </main>
    </div>
  );
}
