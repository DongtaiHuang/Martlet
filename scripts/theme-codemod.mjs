// Map raw Tailwind palette classes to Martlet colour tokens (ADR 0012).
//   node scripts/theme-codemod.mjs <files...>          rewrite files in place
//   node scripts/theme-codemod.mjs --check <files...>  only report
// Variants (hover:, focus-visible:, sm:, aria-pressed:, …) and opacity (/50) are preserved.
// Anything not in the map is reported for manual review (e.g. category or image-overlay colours).
import { readFileSync, writeFileSync } from "node:fs";

const MAP = {
  bg: {
    white: "surface", "stone-50": "canvas", "neutral-50": "canvas", "stone-100": "surface-muted", "stone-200": "line",
    "red-800": "brand", "red-700": "brand", "red-900": "brand-hover", "red-50": "brand-soft", "red-100": "brand-muted",
    "amber-50": "warn-soft", "amber-100": "warn-muted", "green-50": "ok-soft",
  },
  text: {
    "stone-950": "ink", "neutral-950": "ink", "stone-900": "ink-soft", "neutral-900": "ink-soft", "stone-800": "ink-soft", "neutral-800": "ink-soft",
    "stone-700": "ink-2", "neutral-700": "ink-2", "stone-600": "ink-muted", "neutral-600": "ink-muted", "stone-500": "ink-subtle", "neutral-500": "ink-subtle",
    "red-800": "brand-ink", "red-700": "brand-ink", "red-900": "brand-ink-strong",
    "amber-900": "warn-ink", "amber-950": "warn-ink", "green-800": "ok-ink", "emerald-800": "ok-ink",
  },
  border: {
    "stone-200": "line", "neutral-200": "line", "stone-100": "line-soft", "stone-300": "line-strong", "neutral-300": "line-strong",
    "red-200": "brand-line", "red-300": "brand-line", "red-800": "brand", "red-700": "brand",
    "amber-200": "warn-line", "green-200": "ok-line",
  },
  divide: { "stone-100": "line-soft", "stone-200": "line" },
  outline: { "red-700": "focus", "red-800": "focus" },
  ring: { "red-700": "focus", "red-100": "brand-soft" },
  accent: { "red-800": "brand" },
  decoration: { "red-300": "brand-line", "red-800": "brand-ink" },
};
const COLOR = "(?:white|black|(?:stone|neutral|red|amber|green|emerald|rose|sky|slate|gray|zinc|orange|indigo|violet)-\\d{2,3})";
const RE = new RegExp(`(?<=^|[\\s"'\`{])((?:[a-z0-9-]+:)*)(bg|text|border|divide|outline|ring|accent|from|via|to|fill|stroke|placeholder|decoration)-(${COLOR})(\\/\\d+)?(?=$|[\\s"'\`}])`, "g");

const args = process.argv.slice(2);
const check = args[0] === "--check";
const files = check ? args.slice(1) : args;
let changed = 0;
for (const file of files) {
  const src = readFileSync(file, "utf8");
  const left = new Set();
  const out = src.replace(RE, (m, variants, util, color, alpha = "") => {
    const token = MAP[util]?.[color];
    if (!token) { left.add(m.trim()); return m; }
    changed++;
    return `${variants}${util}-${token}${alpha}`;
  });
  // White text on a brand-filled element becomes text-on-brand (white over photos/overlays stays white).
  const final = out.replace(/(["'`])([^"'`]*\bbg-brand\b[^"'`]*)\1/g, (m, q, cls) => {
    const next = cls.replace(/(^|\s)((?:[a-z0-9-]+:)*)text-white(?=\s|$)/g, (_, sp, v) => { changed++; return `${sp}${v}text-on-brand`; });
    return `${q}${next}${q}`;
  });
  if (!check && final !== src) writeFileSync(file, final);
  const remaining = [...left].filter((c) => new RegExp(`(^|[\\s"'\`])${c.replace(/[/:]/g, "\\$&")}(?=$|[\\s"'\`])`).test(final));
  if (remaining.length) console.log(`${file}: unmapped → ${remaining.join(" ")}`);
}
console.log(`${check ? "would change" : "changed"} ${changed} class(es) in ${files.length} file(s)`);
