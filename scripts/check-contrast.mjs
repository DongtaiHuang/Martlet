// WCAG contrast check for every theme × mode in app/theme.css (ADR 0014). Runs in CI.
//   node scripts/check-contrast.mjs
// Checks the text/background pairs the app actually uses. Body text needs 4.5:1 (AA);
// subtle icon/hint text and focus rings need 3:1.
import { readFileSync } from "node:fs";

const css = readFileSync(new URL("../app/theme.css", import.meta.url), "utf8");

// Collect --m-* values per (theme, mode). ":root" is McGill Classic light.
const palettes = new Map();
for (const [, selector, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
  const targets = [];
  for (const part of selector.split(",")) {
    const theme = part.match(/data-theme="([^"]+)"/)?.[1];
    const mode = part.match(/data-mode="([^"]+)"/)?.[1];
    if (theme && mode) targets.push(`${theme}/${mode}`);
    else if (part.trim() === ":root") targets.push("classic/light");
  }
  const vars = Object.fromEntries([...body.matchAll(/--m-([\w-]+):\s*(#[0-9a-fA-F]{6})/g)].map(([, k, v]) => [k, v]));
  if (!Object.keys(vars).length) continue;
  for (const t of targets) palettes.set(t, { ...(palettes.get(t) ?? {}), ...vars });
}

const lum = (hex) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };

const PAIRS = [
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

let failures = 0;
for (const [name, p] of [...palettes].sort()) {
  const bad = [];
  for (const [fg, bg, min] of PAIRS) {
    if (!p[fg] || !p[bg]) { bad.push(`${fg}/${bg}: missing`); continue; }
    const r = ratio(p[fg], p[bg]);
    if (r < min) bad.push(`${fg} on ${bg} = ${r.toFixed(2)} (needs ${min})`);
  }
  failures += bad.length;
  console.log(`${bad.length ? "FAIL" : "PASS"}  ${name}${bad.length ? "\n      " + bad.join("\n      ") : ""}`);
}
console.log(failures ? `\n${failures} contrast problem(s).` : `\nAll ${palettes.size} theme/mode palettes meet WCAG AA for ${PAIRS.length} text pairs.`);
process.exit(failures ? 1 : 0);
