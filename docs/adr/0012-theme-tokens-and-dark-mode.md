# 0012. Colour tokens, themes and dark mode

- **Status:** Proposed
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
- **Rollout without visual change:**
  1. Tokens: light "McGill Classic" reproduces the original palette exactly. The default mode stays `light`.
  2. Migrate one area per PR with `scripts/theme-codemod.mjs`, which maps raw classes to tokens, keeps variants and reports anything unmapped. The area's owner reviews.
  3. When every area uses tokens, change `DEFAULT_MODE` to `system` and add the Light / Dark / System toggle.
  4. Then the dark map style, 3D scenes following the mode, the theme picker, extra themes (Redpath, Mount Royal, High contrast) and a CI contrast check.
- **Accessibility:** every theme × mode must meet WCAG AA contrast (4.5:1 for body text, 3:1 for large text and UI). A CI check enforces this in step 4.

## Consequences

- Themes and dark mode become CSS-only changes once the migration is complete.
- Class names become more meaningful (`text-ink-muted` rather than `text-stone-600`). New code must use tokens; reviewers should flag raw palette colours.
- During migration, a user forcing dark mode through `localStorage` would see a mixed page. The toggle stays hidden until step 3.
- The map and the Three.js scenes don't read CSS classes. They will read the same variables through `getComputedStyle` in step 4.
