// WCAG contrast check for every theme × mode in app/theme.css (ADR 0014). Runs in CI.
//   node scripts/check-contrast.mjs
// The pairs and maths live in lib/contrast.ts, shared with custom themes (ADR 0029).
import { readFileSync } from "node:fs";
import { CONTRAST_PAIRS, contrastProblems } from "../lib/contrast.ts";

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

let failures = 0;
for (const [name, p] of [...palettes].sort()) {
  const bad = contrastProblems(p);
  failures += bad.length;
  console.log(`${bad.length ? "FAIL" : "PASS"}  ${name}${bad.length ? "\n      " + bad.join("\n      ") : ""}`);
}
console.log(failures ? `\n${failures} contrast problem(s).` : `\nAll ${palettes.size} theme/mode palettes meet WCAG AA for ${CONTRAST_PAIRS.length} text pairs.`);
process.exit(failures ? 1 : 0);
