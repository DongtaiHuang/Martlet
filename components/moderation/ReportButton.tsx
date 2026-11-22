"use client";

import { useRef, useState, useTransition } from "react";
import { Flag } from "lucide-react";
import { reportCommunityAction } from "@/app/moderation/actions";
import { REPORT_REASONS } from "@/lib/board-catalog";
import type { CommunityType } from "@/lib/moderation";

export function ReportButton({ type, id, landmarkId = "" }: { type: CommunityType; id: string; landmarkId?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const close = () => dialogRef.current?.close();
  const label = type === "meetup" ? "meetup" : "photo";
  return (
    <>
      <button type="button" onClick={() => { setMessage(null); setOk(false); dialogRef.current?.showModal(); }}
        className="inline-flex min-h-11 items-center gap-1 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-muted hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        <Flag aria-hidden="true" size={15}/> Report {label}
      </button>
      <dialog ref={dialogRef} aria-label={`Report this ${label}`}
        className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-5 text-ink shadow-2xl backdrop:bg-black/50">
        <h2 className="text-lg font-bold">Report this {label}</h2>
        {message ? (
          <>
            <p role={ok ? "status" : "alert"} className="mt-2 text-sm">{message}</p>
            {ok ? <button type="button" onClick={close} className="mt-4 min-h-11 rounded-xl bg-brand px-4 font-semibold text-on-brand">Done</button> :
            <button type="button" onClick={() => setMessage(null)} className="mt-4 min-h-11 rounded-xl border border-line px-4 font-semibold">Try again</button>}
          </>
        ) : (
          <form onSubmit={(event) => {
            event.preventDefault();
            const data = new FormData(event.currentTarget);
            start(async () => {
              const result = await reportCommunityAction(type,id,landmarkId,String(data.get("reason") ?? ""),String(data.get("note") ?? ""));
              setMessage(result.message); setOk(result.ok);
            });
          }}>
            <p className="mt-1 text-sm text-ink-muted">Tell us what is wrong. Reports are private and reviewed by moderators.</p>
            <fieldset className="mt-3 grid gap-1">
              <legend className="sr-only">Reason</legend>
              {Object.entries(REPORT_REASONS).map(([value, label],i) =>
                <label key={value} className="flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm hover:bg-surface-muted">
                  <input type="radio" name="reason" value={value} required defaultChecked={i===0}/> {label}
                </label>)}
            </fieldset>
            <label className="mt-3 block text-sm font-semibold">Additional details (optional)
              <textarea name="note" maxLength={300} rows={2} className="mt-1 w-full rounded-xl border border-line-strong bg-surface p-2 font-normal"/>
            </label>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button type="button" onClick={close} className="min-h-11 rounded-xl border border-line-strong px-4 font-semibold">Cancel</button>
              <button type="submit" disabled={pending} className="min-h-11 rounded-xl bg-brand px-4 font-semibold text-on-brand disabled:opacity-60">{pending ? "Sending…" : "Submit report"}</button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
