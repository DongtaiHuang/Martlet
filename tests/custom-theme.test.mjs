import assert from "node:assert/strict";
import test from "node:test";
import { contrastProblems, CONTRAST_PAIRS } from "../lib/contrast.ts";
import { buildCustomTheme, customThemeCss, CUSTOM_CSS_PATTERN, DEFAULT_CUSTOM_COLORS, parseCustomColors } from "../lib/custom-theme.ts";

const SWATCHES = ["#ffffff", "#000000", "#ffff00", "#777777", "#ff0000", "#00ff00", "#0000ff", "#00ffff", "#ff00ff",
  "#991b1b", "#78716c", "#fde68a", "#1f2a44", "#f97316", "#0f766e", "#e11d48", "#a3e635", "#808080", "#111111", "#fefefe"];

test("every generated palette meets the CI contrast pairs in light and dark mode", () => {
  let checked = 0;
  for (const primary of SWATCHES) for (const secondary of SWATCHES.filter((_, i) => i % 3 === 0)) for (const tertiary of ["#ffff00", "#0000ff", "#777777", "#ffffff"]) {
    const theme = buildCustomTheme({ primary, secondary, tertiary });
    for (const mode of ["light", "dark"]) {
      assert.deepEqual(contrastProblems(theme[mode]), [], `${mode} ${primary}/${secondary}/${tertiary}`);
      checked++;
    }
  }
  assert.ok(checked > 500);
  assert.equal(CONTRAST_PAIRS.length, 22);
});

test("generated CSS matches the only shape the before-paint script injects", () => {
  const css = customThemeCss(buildCustomTheme(DEFAULT_CUSTOM_COLORS));
  assert.match(css, new RegExp(CUSTOM_CSS_PATTERN));
  for (const bad of [css + "body{background:url(x)}", css.replace("#", "red;x:#"), "</style><script>", ""]) {
    assert.doesNotMatch(bad, new RegExp(CUSTOM_CSS_PATTERN));
  }
});

test("readable colours are kept and unreadable ones explained", () => {
  assert.deepEqual(buildCustomTheme(DEFAULT_CUSTOM_COLORS).notes, []);
  assert.ok(buildCustomTheme({ primary: "#ffff00", secondary: "#777777", tertiary: "#ffffff" }).notes.length >= 2);
});

test("stored colours are validated", () => {
  assert.deepEqual(parseCustomColors('{"primary":"#AABBCC","secondary":"#000000","tertiary":"#ffffff"}'), { primary: "#aabbcc", secondary: "#000000", tertiary: "#ffffff" });
  for (const raw of [null, "", "{", '{"primary":"red","secondary":"#000000","tertiary":"#ffffff"}', '{"primary":"#abc","secondary":"#000000","tertiary":"#ffffff"}']) {
    assert.equal(parseCustomColors(raw), null, String(raw));
  }
});
