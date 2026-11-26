"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { requestAction, requestMessageAction, requestStatusAction, type FormState } from "@/app/creators/actions";
import { ReportButton } from "@/components/board/BoardControls";
import { DISCIPLINE_INFO, type Discipline } from "@/lib/creator-catalog";
import type { CreatorMessage, CreatorRequest } from "@/lib/creators";

const input = "mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 font-normal text-ink focus-visible:outline-2 focus-visible:outline-focus";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const btn = `inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold disabled:opacity-60 ${focus}`;
const timeFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

/** "Request a commission" on a creator's profile. Starts a private thread. */
export function RequestForm({ creatorId, creatorName, disciplines, today }: { creatorId: string; creatorName: string; disciplines: Discipline[]; today: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestAction.bind(null, creatorId), {});
  const options = [...new Set<Discipline>([...disciplines, "other"])];
  return (
    <form action={action} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-semibold">Kind of work
          <select name="discipline" defaultValue={state.fields?.discipline ?? disciplines[0]} className={input}>
            {options.map((d) => <option key={d} value={d}>{DISCIPLINE_INFO[d].label}</option>)}
          </select>
        </label>
        <label className="text-sm font-semibold">Budget (CAD) <span className="font-normal text-ink-muted">(optional)</span>
          <input name="budget" inputMode="decimal" pattern="\$?\d{1,4}(\.\d{1,2})?" maxLength={8} defaultValue={state.fields?.budget} className={input} placeholder="50" />
        </label>
        <label className="text-sm font-semibold">Needed by <span className="font-normal text-ink-muted">(optional)</span>
          <input name="needed_by" type="date" min={today} defaultValue={state.fields?.needed_by} className={input} />
        </label>
      </div>
      <label className="text-sm font-semibold">What do you need?
        <textarea name="body" required minLength={10} maxLength={1000} rows={4} defaultValue={state.fields?.body} className={input}
          placeholder={`Hi ${creatorName}! I’m looking for…`} />
      </label>
      {state.error && <p role="alert" className="text-sm font-semibold text-brand-ink">{state.error}</p>}
      <button type="submit" disabled={pending} className={`${btn} w-fit bg-brand text-on-brand hover:bg-brand-hover`}>{pending ? "Sending…" : "Send request"}</button>
    </form>
  );
}

/** The private thread on a request, with a reply box while it's open or accepted. */
export function RequestThread({ request, messages, otherName }: { request: CreatorRequest; messages: CreatorMessage[]; otherName: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(requestMessageAction.bind(null, request.id), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!state.error && !pending) form.current?.reset(); }, [state, pending]);
  const canSend = request.status === "open" || request.status === "accepted";

  return (
    <div>
      <ol className="grid gap-2" aria-label={`Messages with ${otherName}`}>
        {messages.map((m) => (
          <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "ml-auto bg-brand-soft text-ink" : "bg-surface-muted text-ink"}`}>
            <p className="sr-only">{m.mine ? "You" : otherName}:</p>
            <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
              <time dateTime={m.created_at}>{timeFormat.format(new Date(m.created_at))}</time>
              {m.status === "hidden" && <span>· Hidden after a report</span>}
              {!m.mine && <ReportButton type="creator_message" id={m.id} />}
            </div>
          </li>
        ))}
      </ol>
      {canSend ? (
        <form ref={form} action={action} className="mt-3">
          <label className="text-sm font-semibold">Reply
            <textarea name="body" required maxLength={1000} rows={2} defaultValue={state.fields?.body} className={input} />
          </label>
          {state.error && <p role="alert" className="mt-1 text-sm font-semibold text-brand-ink">{state.error}</p>}
          <button type="submit" disabled={pending} className={`${btn} mt-2 bg-brand text-on-brand hover:bg-brand-hover`}>{pending ? "Sending…" : "Send"}</button>
        </form>
      ) : (
        <p className="mt-3 text-sm text-ink-muted">This request is {request.status}, so new messages are off.</p>
      )}
    </div>
  );
}

/** Accept or decline (creator, while open), mark done (creator, once accepted), withdraw (client). */
export function RequestStatusControls({ request }: { request: CreatorRequest }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const set = (status: "accepted" | "declined" | "closed", question?: string) => {
    if (question && !confirm(question)) return;
    start(async () => setError(await requestStatusAction(request.id, status)));
  };
  const outline = `${btn} border border-line-strong text-ink`;
  return (
    <div className="flex flex-wrap gap-2">
      {request.i_am_creator && request.status === "open" && (
        <>
          <button type="button" disabled={pending} onClick={() => set("accepted")} className={`${btn} bg-brand text-on-brand hover:bg-brand-hover`}>Accept</button>
          <button type="button" disabled={pending} onClick={() => set("declined", "Decline this request? The thread closes.")} className={outline}>Decline</button>
        </>
      )}
      {request.i_am_creator && request.status === "accepted" && (
        <button type="button" disabled={pending} onClick={() => set("closed", "Mark this request as done? The thread closes.")} className={outline}>Mark done</button>
      )}
      {!request.i_am_creator && (request.status === "open" || request.status === "accepted") && (
        <button type="button" disabled={pending} onClick={() => set("closed", "Withdraw this request? The thread closes.")} className={`${btn} text-brand-ink hover:underline`}>Withdraw request</button>
      )}
      {error && <p role="alert" className="w-full text-sm font-semibold text-brand-ink">{error}</p>}
    </div>
  );
}
