"use client";

import { useState, useTransition, type ComponentType } from "react";

export type ReactionButtonProps = {
  meetupId: string;
  active: boolean;
  count: number;
  /** e.g. host on own meetup, cancelled or past meetup, signed out */
  disabled?: boolean;
};

type Config = {
  label: string;
  activeLabel: string;
  noun: (count: number) => string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  on: (id: string) => Promise<void>;
  off: (id: string) => Promise<void>;
};

export function ReactionButton({ meetupId, active, count, disabled, label, activeLabel, noun, icon: Icon, on, off }: ReactionButtonProps & Config) {
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
        await (prev.active ? off : on)(meetupId);
      } catch (e) {
        setState(prev);
        // Production builds redact server action messages; show them only in dev.
        setError(process.env.NODE_ENV === "development" && e instanceof Error ? e.message : "Couldn't update. Sign in and try again.");
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
        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-semibold text-ink-soft hover:border-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-60 aria-pressed:border-brand aria-pressed:bg-brand aria-pressed:text-on-brand"
      >
        <Icon aria-hidden size={16} className={pending ? "animate-pulse" : undefined} />
        {state.active ? activeLabel : label}
        <span className="tabular-nums">· {state.count} {noun(state.count)}</span>
      </button>
      {error && <span role="alert" className="text-xs text-brand-ink">{error}</span>}
    </span>
  );
}
