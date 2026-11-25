"use client";

import { useActionState, useState } from "react";
import { localTimeToUtc } from "@/lib/local-date-time";
import { proposeAction, type MarketFormState } from "@/app/markets/actions";

const field = "mt-1.5 block w-full rounded-xl border border-line-strong bg-surface px-3 text-base text-ink focus-visible:outline-2 focus-visible:outline-focus";

/** Propose a yes/no market (issue #139). The closing time is picked in the browser's time zone. */
export function ProposeForm() {
  const [state, action, pending] = useActionState<MarketFormState, FormData>(proposeAction, {});
  const [question, setQuestion] = useState(state.fields?.question ?? "");
  const [closesLocal, setClosesLocal] = useState(state.fields?.closes_local ?? "");
  const closesAt = localTimeToUtc(closesLocal);

  return (
    <form action={action} className="space-y-5">
      <div>
        <label htmlFor="question" className="text-sm font-bold text-ink">Question</label>
        <input id="question" name="question" required minLength={10} maxLength={140} value={question} onChange={(e) => setQuestion(e.target.value)}
          placeholder="Will Redpath stay open 24/7 during finals?" aria-describedby="question-help" className={`${field} min-h-11`} />
        <p id="question-help" className="mt-1 text-xs text-ink-muted">A yes/no question about a campus event, ending with “?”. {question.length}/140. No questions about individual people.</p>
      </div>
      <div>
        <label htmlFor="details" className="text-sm font-bold text-ink">How it resolves</label>
        <textarea id="details" name="details" required minLength={10} maxLength={1000} rows={4} defaultValue={state.fields?.details}
          placeholder="Resolves YES if the McGill Library hours page lists Redpath as open 24 hours for the whole exam period."
          aria-describedby="details-help" className={`${field} py-2`} />
        <p id="details-help" className="mt-1 text-xs text-ink-muted">Name the source and the exact condition, so anyone can check the answer.</p>
      </div>
      <div>
        <label htmlFor="closes" className="text-sm font-bold text-ink">Trading closes</label>
        <input id="closes" name="closes_local" type="datetime-local" required value={closesLocal} onChange={(e) => setClosesLocal(e.target.value)}
          aria-describedby="closes-help" className={`${field} min-h-11`} />
        <input type="hidden" name="closes_at" value={closesAt} />
        <p id="closes-help" className="mt-1 text-xs text-ink-muted">Between 1 hour and 180 days from now, before the answer is known.</p>
      </div>
      <p className="rounded-xl bg-canvas p-3 text-sm text-ink-2">A moderator reviews each market before it opens. You can propose 3 a day.</p>
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {pending ? "Proposing…" : "Propose market"}
      </button>
      <p role="alert" className="text-sm font-semibold text-brand-ink-strong">{state.error ?? ""}</p>
    </form>
  );
}
