"use client";

import { useActionState } from "react";
import { resolveAction, type MarketFormState } from "@/app/markets/actions";

/** Moderator only: settle a market YES, NO or cancelled. Can't be undone. */
export function ResolveForm({ marketId }: { marketId: string }) {
  const [state, action, pending] = useActionState<MarketFormState, FormData>(resolveAction.bind(null, marketId), {});
  return (
    <form action={action} className="space-y-3">
      <fieldset>
        <legend className="text-sm font-bold text-ink">Outcome</legend>
        <div className="mt-1.5 flex flex-wrap gap-2">
          {[["yes", "Yes"], ["no", "No"], ["cancelled", "Cancel and refund"]].map(([value, label]) => (
            <label key={value} className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-2 has-checked:border-brand has-checked:bg-brand-soft has-focus-visible:outline-2 has-focus-visible:outline-focus">
              <input type="radio" name="outcome" value={value} required className="size-4 accent-[var(--m-brand)]" />{label}
            </label>
          ))}
        </div>
      </fieldset>
      <label className="flex items-start gap-2 text-sm text-ink-2">
        <input type="checkbox" name="confirm" className="mt-0.5 size-4 shrink-0 accent-[var(--m-brand)]" />
        I checked the resolution source. Settling pays everyone out and can’t be undone.
      </label>
      <button type="submit" disabled={pending} className="inline-flex min-h-11 items-center rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:border-brand disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-focus">
        {pending ? "Settling…" : "Settle market"}
      </button>
      <p role="status" className={`text-sm font-semibold ${state.error ? "text-brand-ink-strong" : "text-ok-ink"}`}>{state.error ?? state.ok ?? ""}</p>
    </form>
  );
}
