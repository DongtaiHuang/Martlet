"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ArrowBigUp, Check, Flag, Trash2 } from "lucide-react";
import { acceptAction, commentAction, removeAction, reportAction, voteAction, type FormState } from "@/app/board/actions";
import { REPORT_REASONS } from "@/lib/board-catalog";
import type { ReportTarget } from "@/lib/board";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Upvote with an optimistic count. */
export function VoteButton({ postId, votes, voted }: { postId: string; votes: number; voted: boolean }) {
  const [state, setState] = useState({ votes, voted });
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const toggle = () => {
    const next = !state.voted;
    setState({ voted: next, votes: state.votes + (next ? 1 : -1) });
    start(async () => {
      const err = await voteAction(postId, next);
      if (err) { setError(err); setState({ voted: !next, votes: state.votes }); }
    });
  };
  return (
    <>
      <button type="button" onClick={toggle} disabled={pending} aria-pressed={state.voted}
        className={`inline-flex min-h-11 items-center gap-1 rounded-xl border px-3 text-sm font-bold ${focus} ${state.voted ? "border-brand bg-brand text-on-brand" : "border-line-strong bg-surface text-ink-2 hover:border-brand"}`}>
        <ArrowBigUp aria-hidden="true" size={18} /> {state.votes}<span className="sr-only"> upvotes{state.voted ? ", you upvoted" : ""}</span>
      </button>
      {error && <span role="alert" className="text-xs text-brand-ink">{error}</span>}
    </>
  );
}

/** Report with a reason; uses a native <dialog> for focus handling. */
const TARGET_NAMES: Record<ReportTarget, string> = { post: "post", comment: "comment", photo: "photo", listing: "listing", listing_message: "message", table_chat: "message", creator: "profile", creator_message: "message" };

export function ReportButton({ type, id }: { type: ReportTarget; id: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <>
      <button type="button" onClick={() => { setMessage(null); ref.current?.showModal(); }} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-muted hover:text-brand-ink ${focus}`}>
        <Flag aria-hidden="true" size={14} /> Report
      </button>
      <dialog ref={ref} aria-labelledby={`report-${id}`} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/50">
        {message ? (
          <>
            <p role="status" className="text-sm text-ink-2">{message}</p>
            <button type="button" onClick={() => ref.current?.close()} className={`mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand ${focus}`}>Done</button>
          </>
        ) : (
          <form onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            start(async () => setMessage(await reportAction(type, id, String(f.get("reason")), String(f.get("note") ?? ""))));
          }}>
            <h2 id={`report-${id}`} className="text-lg font-bold">Report this {TARGET_NAMES[type]}</h2>
            <p className="mt-1 text-sm text-ink-muted">Reports are anonymous to the {type === "photo" ? "person who shared it" : type === "listing" ? "seller" : type === "creator" ? "creator" : "author"}. {type === "listing_message" || type === "table_chat" || type === "creator_message" ? "Your report hides this message until a moderator checks." : "Three reports hide it until a moderator checks."}</p>
            <fieldset className="mt-3 grid gap-1">
              <legend className="sr-only">Reason</legend>
              {Object.entries(REPORT_REASONS).map(([value, label], i) => (
                <label key={value} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface-muted">
                  <input type="radio" name="reason" value={value} required defaultChecked={i === 0} className="accent-[var(--m-brand)]" /> {label}
                </label>
              ))}
            </fieldset>
            <label className="mt-3 block text-sm font-semibold">Anything to add? <span className="font-normal text-ink-muted">(optional)</span>
              <textarea name="note" maxLength={300} rows={2} className="mt-1 w-full rounded-lg border border-line-strong bg-surface p-2 text-sm font-normal" />
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => ref.current?.close()} className={`inline-flex min-h-11 items-center rounded-xl border border-line-strong px-4 text-sm font-bold ${focus}`}>Cancel</button>
              <button type="submit" disabled={pending} className={`inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 ${focus}`}>{pending ? "Sending…" : "Send report"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

export function CommentForm({ postId, label }: { postId: string; label: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(commentAction.bind(null, postId), {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => { if (!state.error && !pending) ref.current?.reset(); }, [state, pending]);
  return (
    <form ref={ref} action={action} className="mt-4">
      <label htmlFor={`c-${postId}`} className="text-sm font-semibold">{label}</label>
      <textarea id={`c-${postId}`} name="body" required maxLength={1000} rows={3} defaultValue={state.fields?.body} className="mt-1 w-full rounded-xl border border-line-strong bg-surface p-3 text-sm" />
      {state.error && <p role="alert" className="mt-1 text-sm text-brand-ink">{state.error}</p>}
      <button type="submit" disabled={pending} className={`mt-2 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 ${focus}`}>{pending ? "Posting…" : "Post"}</button>
    </form>
  );
}

export function AcceptButton({ postId, commentId, accepted }: { postId: string; commentId: string; accepted: boolean }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} onClick={() => start(() => acceptAction(postId, accepted ? null : commentId))}
      className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold ${accepted ? "text-ok-ink" : "text-ink-muted hover:text-ok-ink"} ${focus}`}>
      <Check aria-hidden="true" size={14} /> {accepted ? "Unmark best answer" : "Mark as best answer"}
    </button>
  );
}

export function RemoveButton({ type, id, postId }: { type: "post" | "comment"; id: string; postId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  return confirming ? (
    <span className="inline-flex items-center gap-1 text-xs">
      Delete?
      <button type="button" disabled={pending} onClick={() => start(() => removeAction(type, id, postId))} className={`min-h-11 rounded-lg px-2 font-bold text-brand-ink ${focus}`}>Yes</button>
      <button type="button" onClick={() => setConfirming(false)} className={`min-h-11 rounded-lg px-2 font-semibold text-ink-muted ${focus}`}>No</button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirming(true)} className={`inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-ink-muted hover:text-brand-ink ${focus}`}>
      <Trash2 aria-hidden="true" size={14} /> Delete
    </button>
  );
}
