"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleAlert, RefreshCw } from "lucide-react";

export function FeedUnavailable({ subject = "meetups" }: { subject?: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-5 rounded-2xl border border-red-200 bg-white p-5">
      <div role="alert">
        <h3 className="flex items-center gap-2 font-bold text-red-900"><CircleAlert aria-hidden="true" size={18} /> Couldn’t load {subject}</h3>
        <p className="mt-1 text-sm text-stone-700">Try refreshing the feed.</p>
      </div>
      <button type="button" disabled={pending} onClick={() => startTransition(() => router.refresh())} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-lg bg-red-800 px-4 text-sm font-semibold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 disabled:opacity-60">
        <RefreshCw aria-hidden="true" size={16} /> {pending ? "Refreshing…" : "Try again"}
      </button>
    </div>
  );
}
