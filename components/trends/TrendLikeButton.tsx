"use client";

import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { likeTrend, unlikeTrend } from "./actions";

export type TrendLikeButtonProps = {
  entryId: string;
  active: boolean;
  count: number;
  /** e.g. signed out or preview mode */
  disabled?: boolean;
};

// Optimistic like toggle, modelled on components/social/ReactionButton.tsx.
export function TrendLikeButton({ entryId, active, count, disabled }: TrendLikeButtonProps) {
  const [state, setState] = useState({ active, count });
  const [synced, setSynced] = useState({ active, count });
  if (synced.active !== active || synced.count !== count) {
    // Server data changed (revalidation/refresh): adopt it.
    setSynced({ active, count });
    setState({ active, count });
  }
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function toggle() {
    const prev = state;
    const next = { active: !prev.active, count: prev.count + (prev.active ? -1 : 1) };
    setError("");
    setState(next); // optimistic
    startTransition(async () => {
      try {
        await (prev.active ? unlikeTrend : likeTrend)(entryId);
      } catch {
        setState(prev);
        // Production builds redact server action messages; show them only in dev.
        setError(process.env.NODE_ENV === "development" ? "Couldn’t update. Sign in and try again." : "Couldn’t update. Sign in and try again.");
      }
    });
  }

  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="button"
        aria-pressed={state.active}
        aria-busy={pending}
        disabled={disabled || pending}
        onClick={toggle}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line-strong bg-surface px-3 text-xs font-semibold text-ink-soft hover:border-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-on-brand"
      >
        <Heart aria-hidden="true" size={14} className={state.active ? "fill-current" : undefined} />
        {state.active ? "Liked" : "Like"}
        <span className="tabular-nums">· {state.count}</span>
      </button>
      {error && <span role="alert" className="text-xs text-brand-ink">{error}</span>}
    </span>
  );
}
