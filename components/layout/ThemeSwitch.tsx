"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useModePreference } from "@/lib/useColorMode";
import type { ModePreference } from "@/lib/theme";

const OPTIONS: { value: ModePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Light / Dark / System segmented switch (ADR 0012). */
export function ThemeSwitch() {
  const [pref, setPref] = useModePreference();
  return (
    <div role="radiogroup" aria-label="Colour theme" className="inline-flex shrink-0 rounded-full border border-line bg-surface-muted p-0.5">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const on = pref === value;
        return (
          <button
            key={value} type="button" role="radio" aria-checked={on} title={label} onClick={() => setPref(value)}
            className={`inline-flex size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-focus ${on ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}
          >
            <Icon aria-hidden="true" size={16} />
            <span className="sr-only">{label}</span>
          </button>
        );
      })}
    </div>
  );
}
