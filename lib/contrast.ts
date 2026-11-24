// WCAG 2 contrast maths and the text/background pairs every theme must pass (ADR 0014).
// Shared by scripts/check-contrast.mjs (preset themes, in CI) and lib/custom-theme.ts
// (themes students build from their own colours, ADR 0029), so both use the same rules.

/** [foreground token, background token, minimum ratio]. Body text needs 4.5:1 (AA);
 *  subtle icon/hint text and focus rings need 3:1. */
export const CONTRAST_PAIRS: readonly (readonly [string, string, number])[] = [
  ["ink", "canvas", 4.5], ["ink", "surface", 4.5], ["ink", "surface-muted", 4.5],
  ["ink-soft", "surface", 4.5], ["ink-2", "surface", 4.5], ["ink-2", "canvas", 4.5],
  ["ink-muted", "surface", 4.5], ["ink-muted", "canvas", 4.5], ["ink-muted", "surface-muted", 4.5],
  ["ink-subtle", "surface", 3], ["ink-subtle", "canvas", 3],
  ["brand-ink", "surface", 4.5], ["brand-ink", "canvas", 4.5], ["brand-ink", "brand-soft", 4.5],
  ["brand-ink-strong", "brand-soft", 4.5],
  ["on-brand", "brand", 4.5], ["on-brand", "brand-hover", 4.5],
  ["warn-ink", "warn-soft", 4.5], ["warn-ink", "warn-muted", 4.5], ["ok-ink", "ok-soft", 4.5],
  ["focus", "canvas", 3], ["focus", "surface", 3],
];

/** Relative luminance of a #rrggbb colour. */
export function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Contrast ratio between two #rrggbb colours (1 to 21). */
export function contrastRatio(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

/** Pairs in `palette` (token name → #rrggbb) that miss their minimum, as readable messages. */
export function contrastProblems(palette: Record<string, string>): string[] {
  const problems: string[] = [];
  for (const [fg, bg, min] of CONTRAST_PAIRS) {
    if (!palette[fg] || !palette[bg]) { problems.push(`${fg}/${bg}: missing`); continue; }
    const r = contrastRatio(palette[fg], palette[bg]);
    if (r < min) problems.push(`${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
  }
  return problems;
}
