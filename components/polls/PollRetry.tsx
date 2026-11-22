"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function PollRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <p role="alert" className="text-sm text-brand-ink-strong">Polls are temporarily unavailable.</p>
      <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="mt-2 min-h-11 rounded-lg border border-line-strong px-3 text-sm font-bold text-brand-ink-strong hover:bg-brand-soft disabled:opacity-50">
        {pending ? "Retrying…" : "Retry polls"}
      </button>
    </>
  );
}