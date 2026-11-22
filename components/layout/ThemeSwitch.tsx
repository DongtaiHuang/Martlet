"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useColorMode, useModePreference, useThemePreference } from "@/lib/useColorMode";
import { THEMES, THEME_INFO, type ModePreference } from "@/lib/theme";

const OPTIONS: { value: ModePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Nav control: Light / Dark / System, plus a palette menu to switch theme from any page (ADR 0014). */
export function ThemeSwitch() {
  const [pref, setPref] = useModePreference();
  const [theme, setTheme] = useThemePreference();
  const mode = useColorMode();
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => { document.removeEventListener("pointerdown", onDown); document.removeEventListener("keydown", onKey); };
  }, [open]);

  const btn = "inline-flex size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-focus";
  return (
    <div ref={wrap} className="relative inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface-muted p-0.5">
      <div role="radiogroup" aria-label="Colour mode" className="inline-flex">
        {OPTIONS.map(({ value, label, icon: Icon }) => {
          const on = pref === value;
          return (
            <button key={value} type="button" role="radio" aria-checked={on} title={label} onClick={() => setPref(value)}
              className={`${btn} ${on ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
              <Icon aria-hidden="true" size={16} />
              <span className="sr-only">{label}</span>
            </button>
          );
        })}
      </div>
      <span aria-hidden="true" className="h-5 w-px bg-line" />
      <button type="button" aria-haspopup="true" aria-expanded={open} title="Theme" onClick={() => setOpen((v) => !v)}
        className={`${btn} ${open ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
        <Palette aria-hidden="true" size={16} />
        <span className="sr-only">Choose theme ({THEME_INFO[theme].label})</span>
      </button>
      {open && (
        <div role="radiogroup" aria-label="Theme" className="absolute top-full right-0 z-50 mt-2 w-60 rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          {THEMES.map((id) => {
            const on = theme === id;
            return (
              <button key={id} type="button" role="radio" aria-checked={on} onClick={() => { setTheme(id); setOpen(false); }}
                className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-focus ${on ? "bg-surface-muted" : ""}`}>
                {/* Swatch painted by that theme's own tokens */}
                <span data-theme={id} data-mode={mode} aria-hidden="true" className="flex size-8 shrink-0 overflow-hidden rounded-md border border-line bg-canvas">
                  <span className="w-1/2 bg-brand" /><span className="w-1/2 bg-surface" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">{THEME_INFO[id].label}</span>
                  <span className="block text-xs text-ink-muted">{THEME_INFO[id].description}</span>
                </span>
                {on && <Check aria-hidden="true" size={16} className="shrink-0 text-brand-ink" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
