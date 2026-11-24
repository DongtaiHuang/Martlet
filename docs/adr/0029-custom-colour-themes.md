# 0029. Custom themes from three colours

- **Status:** Proposed
- **Date:** 2026-11-24
- **Amends:** [0014](0014-theme-tokens-and-dark-mode.md) (themes were fixed CSS token sets only)
- **Issue:** #131

## Context

Students asked to build their own theme from a primary, a secondary and a tertiary colour. ADR 0014 defines themes as hand-written token sets in `app/theme.css`, applied before first paint and checked in CI against 22 WCAG AA text pairs. Colours chosen by students can't be checked by CI, and many choices (yellow buttons, grey links) would be unreadable as they are. The token system has no "secondary" or "tertiary" roles, only brand, neutrals, warning and success.

## Decision

- **A fourth kind of theme, `custom`,** alongside the presets (`THEMES` stays the preset list). `lib/custom-theme.ts` turns three colours into every `--m-*` token for light and dark mode:
  - **Primary:** the brand tokens (buttons, links, the active tab).
  - **Secondary:** a tint mixed into the canvas, surfaces, borders and text.
  - **Tertiary:** the brand-muted and brand-line highlights, and the focus ring.
  - **Warning and success** stay McGill Classic's, so they keep their meaning.
- **Readable by construction:** each text colour is stepped lighter or darker until it meets the same pairs CI checks. The pairs now live in `lib/contrast.ts`, shared by `scripts/check-contrast.mjs` and the generator. Button text is white or near-black, whichever reads better. A unit test sweeps over 500 colour combinations, including white, black, neon and mid grey. The editor tells the student, in plain words, when a colour had to change.
- **No flash:** the generated CSS is stored in `localStorage` and injected by the existing before-paint script. It is injected only if it matches `CUSTOM_CSS_PATTERN`, which accepts nothing but our own `[data-theme="custom"][data-mode=…]` rules of `--m-*: #rrggbb` values. Anything else falls back to McGill Classic.
- **Device-only**, like the presets. Nothing is sent to the server.

## Consequences

- Students can't produce an unreadable theme, but their exact colours may be shifted, mostly in dark mode, which always uses lighter shades for text, like the presets.
- Decorative colours that aren't tokens (category hues, illustrations, seasonal scenes) don't follow the custom colours.
- `lib/contrast.ts` is now the single source of the contrast rules; changing a pair affects presets and custom themes together.
- Follow-up: sync the colours to the profile so they follow a student across devices, which needs an RPC and the session user, never a browser-supplied id.
