"use client";

import { useActionState, useState } from "react";
import { submitCancellation } from "@/app/meetups/[id]/actions";

const secondary = "inline-flex min-h-11 items-center rounded-xl border border-stone-300 px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-red-700 hover:bg-stone-100";

export function CancelMeetupForm({ meetupId }: { meetupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(submitCancellation.bind(null, meetupId), {});

  if (state.success) return <p role="status" className="text-sm font-semibold text-stone-700">Meetup cancelled.</p>;
  if (!confirming) {
    return <button type="button" className={`${secondary} text-red-800`} onClick={() => setConfirming(true)}>Cancel meetup</button>;
  }

  return (
    <form action={action} className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="font-bold text-red-900">Cancel this meetup?</p>
      <p className="mt-1 text-sm text-red-900">It will be removed from the upcoming feed.</p>
      {state.message && <p role="alert" className="mt-3 text-sm font-semibold text-red-900">{state.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-red-800 px-4 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60">{pending ? "Cancelling…" : "Confirm cancellation"}</button>
        <button type="button" disabled={pending} className={`bg-white ${secondary}`} onClick={() => setConfirming(false)}>Keep meetup</button>
      </div>
    </form>
  );
}
