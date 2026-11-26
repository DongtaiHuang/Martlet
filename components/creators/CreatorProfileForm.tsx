"use client";

import { useActionState, useState, useTransition } from "react";
import { deleteProfileAction, saveProfileAction, type FormState } from "@/app/creators/actions";
import { DISCIPLINES, DISCIPLINE_INFO, MAX_DISCIPLINES, MAX_LINKS, type Discipline } from "@/lib/creator-catalog";
import type { Creator } from "@/lib/creators";

const input = "mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 font-normal text-ink focus-visible:outline-2 focus-visible:outline-focus";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

/** Create or edit the signed-in student's creator profile. */
export function CreatorProfileForm({ creator }: { creator: Creator | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveProfileAction, {});
  const [picked, setPicked] = useState<Discipline[]>(
    (state.fields?.disciplines?.split(",").filter(Boolean) as Discipline[] | undefined) ?? creator?.disciplines ?? [],
  );
  const [deleting, startDelete] = useTransition();
  const value = (key: string, fallback: string) => state.fields?.[key] ?? fallback;
  const toggle = (d: Discipline) => setPicked(picked.includes(d) ? picked.filter((p) => p !== d) : [...picked, d]);

  return (
    <form action={action} className="grid gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <label className="text-sm font-semibold">Headline
        <input name="headline" required minLength={3} maxLength={80} defaultValue={value("headline", creator?.headline ?? "")} className={input}
          placeholder="e.g. Film photographer for portraits and club events" />
      </label>

      <fieldset>
        <legend className="text-sm font-semibold">What do you offer? <span className="font-normal text-ink-muted">(up to {MAX_DISCIPLINES})</span></legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {DISCIPLINES.map((d) => {
            const on = picked.includes(d);
            return (
              <label key={d} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${on ? "border-brand bg-brand-soft text-brand-ink-strong" : "border-line-strong text-ink-2 hover:border-brand"} ${!on && picked.length >= MAX_DISCIPLINES ? "opacity-50" : ""}`}>
                <input type="checkbox" name="disciplines" value={d} checked={on} disabled={!on && picked.length >= MAX_DISCIPLINES} onChange={() => toggle(d)} className="sr-only" />
                <span aria-hidden="true">{DISCIPLINE_INFO[d].emoji}</span>{DISCIPLINE_INFO[d].label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <label className="text-sm font-semibold">About you and your work <span className="font-normal text-ink-muted">(optional)</span>
        <textarea name="bio" maxLength={1500} rows={5} defaultValue={value("bio", creator?.bio ?? "")} className={input}
          placeholder="Your program, your style, what you like working on, how you usually work with people…" />
      </label>
      <label className="text-sm font-semibold">Rates <span className="font-normal text-ink-muted">(optional)</span>
        <input name="rates" maxLength={200} defaultValue={value("rates", creator?.rates ?? "")} className={input} placeholder="e.g. Portraits from $40, free for student clubs" />
      </label>
      <label className="text-sm font-semibold">Links <span className="font-normal text-ink-muted">(up to {MAX_LINKS}, one per line: SoundCloud, GitHub, Behance, Instagram, your site)</span>
        <textarea name="links" rows={3} defaultValue={value("links", creator?.links.join("\n") ?? "")} className={`${input} font-mono text-sm`} placeholder="https://soundcloud.com/you" />
      </label>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="open" defaultChecked={state.fields ? state.fields.open === "on" : creator?.open_for_requests ?? true} className="mt-1 size-4 accent-[var(--m-brand)]" />
        <span><span className="font-semibold">Open for requests.</span> Turn this off when you’re booked; your profile stays up.</span>
      </label>

      <p className="rounded-xl border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">Martlet doesn’t handle payments. Agree on the price and timing in your request thread, meet on campus, and never share banking details. No doing other students’ graded work.</p>
      {state.error && <p role="alert" className="text-sm font-semibold text-brand-ink">{state.error}</p>}
      {state.success && <p role="status" className="text-sm font-semibold text-ok-ink">{state.success}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={pending} className={`inline-flex min-h-12 items-center rounded-xl bg-brand px-6 font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 ${focus}`}>
          {pending ? "Saving…" : creator ? "Save profile" : "Create profile"}
        </button>
        {creator && (
          <button type="button" disabled={deleting} className={`inline-flex min-h-11 items-center rounded-xl px-4 text-sm font-bold text-brand-ink hover:underline disabled:opacity-60 ${focus}`}
            onClick={() => { if (confirm("Delete your creator profile? Your portfolio and every request thread are deleted too.")) startDelete(() => deleteProfileAction()); }}>
            Delete profile
          </button>
        )}
      </div>
    </form>
  );
}
