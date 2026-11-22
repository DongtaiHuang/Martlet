"use client";

// Profile → Appearance (issue #50, ADR 0014). Each card is a live preview: it carries its own
// data-theme/data-mode, so the real tokens from app/theme.css paint it.
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { THEMES, THEME_INFO, type ModePreference, type ThemeId } from "@/lib/theme";
import { useColorMode, useModePreference, useThemePreference } from "@/lib/useColorMode";

const MODE_OPTIONS: { value: ModePreference; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
];

function Preview({ id }: { id: ThemeId }) {
  return (
    <div aria-hidden="true" className="overflow-hidden rounded-xl border border-line bg-canvas p-2.5">
      <div className="flex items-center gap-1.5">
        <span className="size-3.5 rounded bg-brand" />
        <span className="h-1.5 w-10 rounded bg-ink-muted/60" />
        <span className="ml-auto h-1.5 w-6 rounded bg-brand-ink/70" />
      </div>
      <div className="mt-2 rounded-lg border border-line bg-surface p-2">
        <span className="block h-1.5 w-3/4 rounded bg-ink" />
        <span className="mt-1 block h-1.5 w-1/2 rounded bg-ink-muted/70" />
        <div className="mt-2 flex items-center gap-1.5">
          <span className="rounded-md bg-brand px-1.5 py-0.5 text-[9px] font-bold text-on-brand">Join</span>
          <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[9px] font-bold text-brand-ink">Like</span>
          <span className="ml-auto rounded-full bg-ok-soft px-1.5 py-0.5 text-[9px] font-bold text-ok-ink">{id === "contrast" ? "AAA" : "AA"}</span>
        </div>
      </div>
    </div>
  );
}

export function AppearancePicker() {
  const [theme, setTheme] = useThemePreference();
  const [pref, setPref] = useModePreference();
  const mode = useColorMode();

  return (
    <section aria-labelledby="appearance-heading" className="mt-6 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-6">
      <h2 id="appearance-heading" className="text-lg font-bold">Appearance</h2>
      <p className="mt-1 text-sm text-ink-muted">Saved on this device. Every theme has a light and dark version.</p>

      <div role="radiogroup" aria-label="Theme" className="mt-4 grid gap-3 sm:grid-cols-2">
        {THEMES.map((id) => {
          const on = theme === id;
          return (
            <button
              key={id} type="button" role="radio" aria-checked={on} onClick={() => setTheme(id)}
              className={`group rounded-2xl border p-2 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus ${on ? "border-brand ring-2 ring-brand" : "border-line hover:border-line-strong"}`}
            >
              <div data-theme={id} data-mode={mode}><Preview id={id} /></div>
              <div className="mt-2 flex items-start gap-2 px-1 pb-1">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold text-ink">{THEME_INFO[id].label}</span>
                  <span className="block text-xs text-ink-muted">{THEME_INFO[id].description}</span>
                </span>
                {on && <Check aria-hidden="true" size={18} className="shrink-0 text-brand-ink" />}
              </div>
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p id="mode-label" className="text-sm font-semibold">Mode</p>
        <div role="radiogroup" aria-labelledby="mode-label" className="mt-2 inline-flex rounded-full border border-line bg-surface-muted p-1">
          {MODE_OPTIONS.map(({ value, label, icon: Icon }) => {
            const on = pref === value;
            return (
              <button key={value} type="button" role="radio" aria-checked={on} onClick={() => setPref(value)}
                className={`inline-flex min-h-10 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-focus ${on ? "bg-surface text-brand-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
                <Icon aria-hidden="true" size={15} /> {label}
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
