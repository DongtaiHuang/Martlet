# 0014. Colour tokens, themes and dark mode

- **Status:** Accepted
- **Date:** 2026-11-22
- **Issue:** #50

## Context

Students want dark mode and some choice of style. The UI hard-codes about 510 Tailwind palette classes (`bg-stone-50`, `text-red-800`, …) across 35 files, plus hex colours in the map and 3D scenes. Dark mode can't be added reliably on top of that. Adding `dark:` variants to every class would double the class lists and drift over time. Several developers own these files, so the change has to land in small, reviewable steps.

## Decision

- **Semantic colour tokens.** `app/theme.css` defines CSS variables and exposes them to Tailwind v4 through `@theme inline`. Components use only semantic utilities:

  | Purpose | Tokens |
  |---|---|
  | Surfaces | `canvas`, `surface`, `surface-muted` |
  | Borders | `line`, `line-soft`, `line-strong` |
  | Text | `ink`, `ink-soft`, `ink-2`, `ink-muted`, `ink-subtle` |
  | Brand | `brand`, `brand-hover`, `brand-ink`, `brand-ink-strong`, `brand-soft`, `brand-line`, `on-brand` |
  | Focus | `focus` |
  | Status | `warn-*`, `ok-*` |

  Raw palette classes are allowed only for content colours that must not change with the theme: white text over photos, category hues and illustrations.
- **Themes and modes are attributes,** not class names: `<html data-theme="classic" data-mode="light|dark">`. A theme is a set of variable values. Adding a theme or mode means adding a CSS block, never editing components.
- **No flash of the wrong colours.** `lib/theme.ts` provides a tiny inline script, rendered in `<head>`, that sets the attributes from `localStorage` before first paint. Mode preference is `light`, `dark` or `system`; `system` follows `prefers-color-scheme`.
- **`dark:` variant follows `data-mode`** (not the OS directly), so the in-app switch wins. It's used only for content colours that aren't tokens: category chip hues, placeholder gradients and the avatar backdrop.
- **Switch:** a Light / Dark / System control in the nav (`components/layout/ThemeSwitch.tsx`). The default is **System**, following `prefers-color-scheme`. The choice is saved in `localStorage`, other open tabs sync, and `?mode=light|dark|system` on any URL sets it (useful for reviews).
- **Maps and 3D:** `lib/useColorMode.ts` exposes the resolved mode. The maps use OpenFreeMap's `dark` style in dark mode (overridable with `NEXT_PUBLIC_MAP_STYLE_URL_DARK`) and swap styles in place when the mode changes. MapLibre controls and attribution are restyled for dark. The 3D avatar backdrop follows the mode.
- **Migration:** `scripts/theme-codemod.mjs` converted the existing raw classes (about 480) to tokens in one pass: it keeps variants, turns `text-white` on `bg-brand` into `text-on-brand`, and reports leftovers. It stays in the repo for new code and for reviews.
- **Themes (issue #50):** McGill Classic (default), **Redpath** (warm sandstone and deep red), **Mount Royal** (forest greens and cream) and **High contrast**. Each has a light and dark palette in `app/theme.css`. Users choose in **Profile → Appearance**, where every option is a live preview: the card carries its own `data-theme`/`data-mode`, so the real tokens paint it. The choice is saved in `localStorage`, other tabs sync, and `?theme=<id>` sets it for reviews.
- **Contrast gate:** `scripts/check-contrast.mjs` (`npm run check:contrast`, run in CI) checks 22 text and background pairs in every theme × mode: 4.5:1 for text, 3:1 for subtle hints and focus rings. A new or changed palette can't merge if it fails.
- **Accessibility:** every theme × mode must meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text and UI). A CI check enforces this in step 4.

## Consequences

- Themes and dark mode become CSS-only changes once the migration is complete.
- Class names become more meaningful (`text-ink-muted` rather than `text-stone-600`). New code must use tokens; reviewers should flag raw palette colours.
- A few light-mode reds were consolidated (`red-700` fills now use `brand`, which is `red-800`), a barely visible change.
- Map popups stay light in dark mode on purpose: their content is designed on white and stays readable.
