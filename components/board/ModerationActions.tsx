"use client";

import { useTransition } from "react";
import { moderateAction } from "@/app/board/actions";
import type { ReportTarget } from "@/lib/board";

const btn = "inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60";

export function ModerationActions({ type, id }: { type: ReportTarget; id: string }) {
  const [pending, start] = useTransition();
  const act = (a: "restore" | "remove" | "dismiss") => start(() => moderateAction(type, id, a));
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={pending} onClick={() => act("remove")} className={`${btn} bg-brand text-on-brand hover:bg-brand-hover`}>Remove</button>
      <button type="button" disabled={pending} onClick={() => act("restore")} className={`${btn} border border-line-strong text-ink-2`}>Restore</button>
      <button type="button" disabled={pending} onClick={() => act("dismiss")} className={`${btn} text-ink-muted`}>Dismiss reports</button>
      {type === "post" && <a href={`/board/${id}`} className={`${btn} text-brand-ink underline`}>Open</a>}
      {type === "listing" && <a href={`/marketplace/${id}`} className={`${btn} text-brand-ink underline`}>Open</a>}
      {type === "creator" && <a href={`/creators/${id}`} className={`${btn} text-brand-ink underline`}>Open</a>}
    </div>
  );
}
