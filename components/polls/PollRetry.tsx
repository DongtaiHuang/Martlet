"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";

export function PollRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <>
      <p role="alert" className="text-sm text-red-900">Polls are temporarily unavailable.</p>
      <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="mt-2 min-h-11 rounded-lg border border-stone-300 px-3 text-sm font-bold text-red-900 hover:bg-red-50 disabled:opacity-50">
        {pending ? "Retrying…" : "Retry polls"}
      </button>
    </>
  );
}