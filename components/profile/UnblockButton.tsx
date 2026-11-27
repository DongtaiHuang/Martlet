"use client";

import { useTransition } from "react";
import { unblockAction } from "@/app/board/actions";

export function UnblockButton({ userId, name }: { userId: string; name: string }) {
  const [pending, start] = useTransition();
  return (
    <button type="button" disabled={pending} aria-label={`Unblock ${name}`}
      onClick={() => start(() => unblockAction(userId))}
      className="inline-flex min-h-11 shrink-0 items-center rounded-xl border border-line-strong px-4 text-sm font-bold text-ink hover:border-brand disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
      {pending ? "Unblocking…" : "Unblock"}
    </button>
  );
}
