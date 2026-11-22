"use client";

import { useActionState, useEffect, useRef } from "react";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { submitTrendEntry, type TrendActionState } from "./actions";

const TYPE_OPTIONS = [
  { value: "coffee", label: "Coffee spot" },
  { value: "study", label: "Study spot" },
  { value: "recipe", label: "Morning recipe" },
  { value: "song", label: "Song" },
] as const;

const initialState: TrendActionState = {};

export function TrendAddForm() {
  const [state, formAction, pending] = useActionState(submitTrendEntry, initialState);
  const formRef = useRef<HTMLFormElement>(null);
  const errors = state.errors ?? {};

  useEffect(() => {
    if (state.message) formRef.current?.reset();
  }, [state.message]);

  const field = "min-h-11 w-full rounded-xl border border-line-strong bg-canvas px-3 text-sm text-ink focus-visible:outline-2 focus-visible:outline-focus";

  return (
    <details className="mt-4 rounded-xl border border-line bg-canvas">
      <summary className="min-h-11 cursor-pointer select-none list-none px-4 py-3 text-sm font-bold text-brand-ink focus-visible:outline-2 focus-visible:outline-focus">
        + Share a trend
      </summary>
      <form ref={formRef} action={formAction} className="space-y-3 px-4 pb-4" aria-describedby={errors.form ? "trend-form-error" : undefined}>
        <div>
          <label htmlFor="trend-type" className="mb-1 block text-xs font-bold text-ink-soft">Type</label>
          <select id="trend-type" name="type" required defaultValue="coffee" className={field}>
            {TYPE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="trend-title" className="mb-1 block text-xs font-bold text-ink-soft">Title</label>
          <input id="trend-title" name="title" required maxLength={120} placeholder="e.g. Le James flat white" className={field} />
          {errors.title && <p role="alert" className="mt-1 text-xs text-brand-ink">{errors.title}</p>}
        </div>
        <div>
          <label htmlFor="trend-detail" className="mb-1 block text-xs font-bold text-ink-soft">Why it’s great <span className="text-ink-muted">(optional)</span></label>
          <textarea id="trend-detail" name="detail" rows={2} maxLength={280} className={field} />
          {errors.detail && <p role="alert" className="mt-1 text-xs text-brand-ink">{errors.detail}</p>}
        </div>
        <div>
          <label htmlFor="trend-link" className="mb-1 block text-xs font-bold text-ink-soft">Link <span className="text-ink-muted">(https, e.g. a Spotify track)</span></label>
          <input id="trend-link" name="link" type="url" maxLength={300} placeholder="https://open.spotify.com/track/…" className={field} />
          {errors.link && <p role="alert" className="mt-1 text-xs text-brand-ink">{errors.link}</p>}
        </div>
        <div>
          <label htmlFor="trend-location" className="mb-1 block text-xs font-bold text-ink-soft">Campus location <span className="text-ink-muted">(optional)</span></label>
          <select id="trend-location" name="campus_location_id" defaultValue="" className={field}>
            <option value="">Address-free</option>
            {CAMPUS_LOCATIONS.map((place) => <option key={place.id} value={place.id}>{place.name}</option>)}
          </select>
          {errors.campus_location_id && <p role="alert" className="mt-1 text-xs text-brand-ink">{errors.campus_location_id}</p>}
        </div>
        {errors.form && <p id="trend-form-error" role="alert" className="text-xs font-semibold text-brand-ink">{errors.form}</p>}
        {state.message && <p role="status" className="text-xs font-semibold text-brand-ink">{state.message}</p>}
        <button
          type="submit"
          disabled={pending}
          className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60"
        >
          {pending ? "Sharing…" : "Share to trends"}
        </button>
      </form>
    </details>
  );
}
