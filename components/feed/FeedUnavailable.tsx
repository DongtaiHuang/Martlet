"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw } from "lucide-react";

export function FeedUnavailable({ subject = "meetups" }: { subject?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-5 rounded-2xl border border-brand-line bg-surface p-5">
      <div role="alert">
        <h3 className="flex items-center gap-2 font-bold text-brand-ink-strong"><CircleAlert aria-hidden="true" size={18} /> Couldn’t load {subject}</h3>
        <p className="mt-1 text-sm text-ink-2">Try refreshing the feed.</p>
      </div>
      <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-brand px-4 text-sm font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60">
        <RefreshCw aria-hidden="true" size={16} /> {pending ? "Refreshing…" : "Try again"}
      </button>
    </div>
  );
}
