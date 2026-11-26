"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { listingStatusAction, messageAction, removeListingAction, renewListingAction, type FormState } from "@/app/marketplace/actions";
import { ReportButton } from "@/components/board/BoardControls";
import type { Thread } from "@/lib/marketplace";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const btn = `inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold disabled:opacity-60 ${focus}`;

const timeFormat = new Intl.DateTimeFormat("en-CA", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

/** One conversation: the buyer's thread with the seller. */
export function MessageThread({ listingId, thread, buyerId, otherName, canSend }: {
  listingId: string; thread: Thread | null; buyerId: string | null; otherName: string; canSend: boolean;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(messageAction.bind(null, listingId, buyerId), {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!state.error && !pending) form.current?.reset(); }, [state, pending]);
  const messages = thread?.messages ?? [];

  return (
    <div>
      {messages.length > 0 && (
        <ol className="grid gap-2" aria-label={`Messages with ${otherName}`}>
          {messages.map((m) => (
            <li key={m.id} className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.mine ? "ml-auto bg-brand-soft text-ink" : "bg-surface-muted text-ink"}`}>
              <p className="sr-only">{m.mine ? "You" : otherName}:</p>
              <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{m.body}</p>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-ink-muted">
                <time dateTime={m.created_at}>{timeFormat.format(new Date(m.created_at))}</time>
                {m.status === "hidden" && <span>· Hidden after a report</span>}
                {!m.mine && <ReportButton type="listing_message" id={m.id} />}
              </div>
            </li>
          ))}
        </ol>
      )}
      {canSend && (
        <form ref={form} action={action} className="mt-3">
          <label className="text-sm font-semibold">{messages.length ? "Reply" : `Message ${otherName}`}
            <textarea name="body" required maxLength={1000} rows={2} defaultValue={state.fields?.body}
              placeholder={messages.length ? "" : "Hi! Is this still available? I could meet at…"}
              className="mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 font-normal text-ink focus-visible:outline-2 focus-visible:outline-focus" />
          </label>
          {state.error && <p role="alert" className="mt-1 text-sm font-semibold text-brand-ink">{state.error}</p>}
          <button type="submit" disabled={pending} className={`${btn} mt-2 bg-brand text-on-brand hover:bg-brand-hover`}>{pending ? "Sending…" : "Send"}</button>
        </form>
      )}
    </div>
  );
}

/** The seller's buttons: reserve, mark sold, reopen, renew, remove. */
export function SellerControls({ id, status, canRenew }: { id: string; status: string; canRenew: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (task: () => Promise<string | null>) => start(async () => setError(await task()));
  if (status === "hidden" || status === "removed") return null;
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {status !== "reserved" && status !== "sold" && <button type="button" disabled={pending} onClick={() => run(() => listingStatusAction(id, "reserved"))} className={`${btn} border border-line-strong text-ink`}>Mark reserved</button>}
      {status !== "sold" && <button type="button" disabled={pending} onClick={() => run(() => listingStatusAction(id, "sold"))} className={`${btn} border border-line-strong text-ink`}>Mark sold</button>}
      {status !== "active" && <button type="button" disabled={pending} onClick={() => run(() => listingStatusAction(id, "active"))} className={`${btn} border border-line-strong text-ink`}>Mark available</button>}
      {canRenew && <button type="button" disabled={pending} onClick={() => run(() => renewListingAction(id))} className={`${btn} border border-line-strong text-ink`}>Renew for 30 days</button>}
      <button type="button" disabled={pending} onClick={() => { if (confirm("Remove this listing? It disappears for everyone, and its photos are deleted.")) start(() => removeListingAction(id)); }}
        className={`${btn} text-brand-ink hover:underline`}>Remove</button>
      {error && <p role="alert" className="w-full text-sm font-semibold text-brand-ink">{error}</p>}
    </div>
  );
}
