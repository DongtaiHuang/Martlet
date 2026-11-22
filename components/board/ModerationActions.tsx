"use client";

import { useState, useTransition } from "react";
import { reviewAction } from "@/app/moderation/actions";
import type { TargetType } from "@/lib/moderation";

const btn = "inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60";
export function ModerationActions({ type, id, landmarkId = "" }: { type: TargetType; id: string; landmarkId?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [note, setNote] = useState("");
  const act = (action: "restore" | "remove" | "dismiss") => start(async () => {
    const result = await reviewAction(type,id,landmarkId,action,note.trim());
    setError(result.error ?? null);
    if (!result.error) setConfirm(false);
  });
  return (
    <div className="mt-3">
      {error && <p role="alert" className="mb-2 text-sm text-brand-ink">{error}</p>}
      {confirm ? (
        <div className="space-y-2 rounded-xl border border-line bg-surface-muted p-3">
          <p className="text-sm font-semibold">Remove this content from public view?</p>
          <label className="block text-xs font-semibold">Moderator note (optional, up to 300 characters)
            <textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={300} rows={2} className="mt-1 block w-full rounded-lg border border-line-strong bg-surface p-2 text-sm font-normal"/>
          </label>
          <div className="flex flex-wrap gap-2">
            <button type="button" disabled={pending} onClick={()=>act("remove")} className={`${btn} bg-brand px-4 text-on-brand`}>Confirm removal</button>
            <button type="button" disabled={pending} onClick={()=>setConfirm(false)} className={`${btn} border border-line px-4`}>Cancel</button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" disabled={pending} onClick={()=>setConfirm(true)} className={`${btn} bg-brand text-on-brand hover:bg-brand-hover`}>Remove</button>
          <button type="button" disabled={pending} onClick={()=>act("restore")} className={`${btn} border border-line-strong text-ink-2`}>Restore</button>
          <button type="button" disabled={pending} onClick={()=>act("dismiss")} className={`${btn} text-ink-muted`}>Dismiss reports</button>
        </div>
      )}
    </div>
  );
}
