"use client";

import { useActionState, useState } from "react";
import { submitCancellation } from "@/app/meetups/[id]/actions";

const secondary = "inline-flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-focus hover:bg-surface-muted";

export function CancelMeetupForm({ meetupId }: { meetupId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [state, action, pending] = useActionState(submitCancellation.bind(null, meetupId), {});

  if (state.success) return <p role="status" className="text-sm font-semibold text-ink-2">Meetup cancelled.</p>;
  if (!confirming) {
    return <button type="button" className={`${secondary} text-brand-ink`} onClick={() => setConfirming(true)}>Cancel meetup</button>;
  }

  return (
    <form action={action} className="rounded-xl border border-brand-line bg-brand-soft p-4">
      <p className="font-bold text-brand-ink-strong">Cancel this meetup?</p>
      <p className="mt-1 text-sm text-brand-ink-strong">It will be removed from the upcoming feed.</p>
      {state.message && <p role="alert" className="mt-3 text-sm font-semibold text-brand-ink-strong">{state.message}</p>}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60">{pending ? "Cancelling…" : "Confirm cancellation"}</button>
        <button type="button" disabled={pending} className={`bg-surface ${secondary}`} onClick={() => setConfirming(false)}>Keep meetup</button>
      </div>
    </form>
  );
}
