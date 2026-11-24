"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Check, Monitor, Moon, Palette, Sun } from "lucide-react";
import { useColorMode, useCustomTheme, useModePreference, useThemePreference } from "@/lib/useColorMode";
import { CUSTOM_THEME, THEMES, THEME_INFO, type ModePreference, type ThemeId } from "@/lib/theme";

const OPTIONS: { value: ModePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

/** Nav control: Light / Dark / System, plus a palette menu to switch theme from any page (ADR 0014). */
/** `account`: sign in/out controls, shown inside the menu on phones where the header has no room. */
export function ThemeSwitch({ account }: { account?: ReactNode }) {
  const [pref, setPref] = useModePreference();
  const [theme, setTheme] = useThemePreference();
  const [customColors] = useCustomTheme();
  // "Your colours" appears once the student has made one in Profile → Appearance (ADR 0029).
  const themeIds: ThemeId[] = customColors ? [...THEMES, CUSTOM_THEME] : [...THEMES];
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

  const btn = "inline-flex size-10 sm:size-9 items-center justify-center rounded-full focus-visible:outline-2 focus-visible:outline-focus";
  return (
    <div ref={wrap} className="relative inline-flex shrink-0 items-center gap-1 rounded-full border border-line bg-surface-muted p-0.5">
      <div role="radiogroup" aria-label="Colour mode" className="hidden sm:inline-flex">
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
      <span aria-hidden="true" className="hidden h-5 w-px bg-line sm:block" />
      <button type="button" aria-haspopup="true" aria-expanded={open} title="Theme" onClick={() => setOpen((v) => !v)}
        className={`${btn} ${open ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
        <Palette aria-hidden="true" size={16} />
        <span className="sr-only">Choose theme ({THEME_INFO[theme].label})</span>
      </button>
      {open && (
        <div className="absolute top-full right-0 z-50 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border border-line bg-surface p-1.5 shadow-xl">
          <div role="radiogroup" aria-label="Colour mode" className="mb-1.5 grid grid-cols-3 gap-1 rounded-lg bg-surface-muted p-1 sm:hidden">
            {OPTIONS.map(({ value, label, icon: Icon }) => (
              <button key={value} type="button" role="radio" aria-checked={pref === value} onClick={() => setPref(value)}
                className={`flex min-h-11 flex-col items-center justify-center gap-0.5 rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-focus ${pref === value ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted"}`}>
                <Icon aria-hidden="true" size={16} />{label}
              </button>
            ))}
          </div>
          <div role="radiogroup" aria-label="Theme">
          {themeIds.map((id) => {
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
          {account && <div className="mt-1.5 flex justify-end border-t border-line pt-2 sm:hidden">{account}</div>}
        </div>
      )}
    </div>
  );
}
