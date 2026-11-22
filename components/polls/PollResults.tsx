"use client";

import { useActionState, useEffect, useState } from "react";
import { MeetupStartTime } from "@/app/meetups/[id]/MeetupStartTime";
import { isPollOpen, votePercentages } from "@/lib/poll-validation";
import type { MeetupPollData } from "@/types/poll";
import { submitPollVote } from "./actions";

export function PollResults({ poll, preview = false }: { poll: MeetupPollData; preview?: boolean }) {
  const [state, action, pending] = useActionState(submitPollVote.bind(null, poll.id), {});
  const [choice, setChoice] = useState<string | null>(null);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    if (!poll.isOpen) return;
    let timer: number;
    function schedule() {
      const now = Date.now();
      if (!isPollOpen(poll.isOpen, poll.closesAt, now)) {
        setExpired(true);
        return;
      }
      timer = window.setTimeout(schedule, Math.min(Date.parse(poll.closesAt) - now, 2_147_483_647));
    }
    timer = window.setTimeout(schedule, 0);
    return () => window.clearTimeout(timer);
  }, [poll.isOpen, poll.closesAt]);

  const open = !preview && poll.isOpen && !expired;
  const selected = choice ?? poll.selectedOptionId;
  const counts = poll.options.map(({ votes }) => votes);
  const total = counts.reduce((sum, count) => sum + count, 0);
  const percentages = votePercentages(counts);

  return (
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="min-w-0 text-lg font-extrabold [overflow-wrap:anywhere]">{poll.question}</h3>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${open ? "bg-brand-muted text-brand-ink-strong" : "bg-surface-muted text-ink-2"}`}>
          {preview ? "Sample poll" : open ? "Open" : "Closed"}
        </span>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        {!preview && open && <>Closes <MeetupStartTime startsAt={poll.closesAt} /> · </>}
        {total} {total === 1 ? "vote" : "votes"}
      </p>
      <form action={action} className="mt-4">
        <fieldset disabled={pending} className="min-w-0 space-y-2 disabled:opacity-70">
          <legend className="sr-only">Poll choices and results</legend>
          {poll.options.map((option, index) => {
            const label = option.proposedAt ? <MeetupStartTime startsAt={option.proposedAt} /> : option.label;
            return (
              <div key={option.id} className="rounded-xl border border-line bg-surface px-3 py-2">
                <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                  {open ? (
                    <label className="inline-flex min-h-8 min-w-0 flex-1 cursor-pointer items-center gap-2 font-semibold [overflow-wrap:anywhere]">
                      <input type="radio" name="option" value={option.id} checked={selected === option.id} onChange={() => setChoice(option.id)} className="shrink-0 accent-brand" />
                      <span className="min-w-0">{label}</span>
                    </label>
                  ) : <span className="min-w-0 font-semibold [overflow-wrap:anywhere]">{label}</span>}
                  <span className="self-center text-ink-2">{option.votes} {option.votes === 1 ? "vote" : "votes"} · {percentages[index]}%</span>
                </div>
                {poll.selectedOptionId === option.id && <p className="text-xs font-semibold text-brand-ink-strong">Your vote</p>}
                <div aria-hidden="true" className="mt-1.5 h-1.5 rounded-full bg-line">
                  <div className="h-full rounded-full bg-brand motion-safe:transition-[width]" style={{ width: `${percentages[index]}%` }} />
                </div>
              </div>
            );
          })}
          {open && (
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="submit" name="intent" value="vote" disabled={!selected || selected === poll.selectedOptionId} className="min-h-11 rounded-lg bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50">
                {pending ? "Saving…" : poll.selectedOptionId ? "Change vote" : "Vote"}
              </button>
              {poll.isHost && <button type="submit" name="intent" value="close" className="min-h-11 rounded-lg border border-line-strong px-4 text-sm font-bold text-brand-ink-strong hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus">Close poll</button>}
            </div>
          )}
        </fieldset>
        {state.error && <p role="alert" className="mt-2 text-sm text-brand-ink-strong">{state.error}</p>}
        {state.message && <p role="status" className="mt-2 text-sm text-ink-2">{state.message}</p>}
      </form>
    </>
  );
}
