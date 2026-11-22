// Run against the app in mock mode. Set APP_URL and install Playwright locally.
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const { APP_URL, BROWSER_MODULE, BROWSER_EXECUTABLE, SCREENSHOT_DIR } = process.env;
const { chromium } = await import(BROWSER_MODULE ? pathToFileURL(resolve(BROWSER_MODULE)).href : "playwright");
const base = APP_URL ?? "http://localhost:3000";
const browser = await chromium.launch({
  executablePath: BROWSER_EXECUTABLE,
  args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
});

try {
  for (const [label, width] of [["mobile", 375], ["tablet", 768], ["desktop", 1440]]) {
    const page = await browser.newPage({ viewport: { width, height: 900 }, reducedMotion: "reduce" });
    await page.goto(new URL("/meetups/new", base).href);
    const picker = page.getByRole("group", { name: "Categories" });
    const category = (name) => picker.getByRole("checkbox", { name, exact: true });
    const course = page.getByRole("combobox", { name: "Search McGill courses" });
    const selected = () => picker.locator('input[name="categories"]').evaluateAll((fields) => fields.map((field) => field.value));
    await picker.getByText("0 of 3 selected").waitFor();
    await category("Coffee").press("Space");
    await picker.getByText("1 of 3 selected").waitFor();
    await category("Study").press("Space");
    await course.waitFor();
    assert.deepEqual(await selected(), ["coffee", "study"]);
    assert.ok(await category("Other").isDisabled());
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));

    if (SCREENSHOT_DIR && label !== "tablet") {
      await mkdir(SCREENSHOT_DIR, { recursive: true });
      await picker.screenshot({ path: resolve(SCREENSHOT_DIR, `${label}.png`), animations: "disabled" });
    }

    await category("Food").press("Space");
    await picker.getByText("3 of 3 selected").waitFor();
    assert.ok(await category("Sports").isDisabled());
    await category("Study").press("Space");
    await course.waitFor({ state: "detached" });
    assert.equal(await page.locator('input[name="course_code"]').count(), 0);
    assert.deepEqual(await selected(), ["coffee", "food"]);
    await category("Coffee").press("Space");
    await category("Food").press("Space");
    await category("Other").press("Space");
    assert.ok(await category("Study").isDisabled());
    assert.deepEqual(await selected(), ["other"]);
    await page.close();
    console.log(`PASS ${label} category picker`);
  }

  const page = await browser.newPage();
  const testTitle = "Coffee & a study break";
  await page.goto(new URL("/meetups", base).href);
  const filters = page.getByRole("group", { name: "Filter by category" });
  const card = page.getByRole("heading", { name: testTitle, exact: true });
  for (const name of ["All", "Coffee", "Study", "Sports"]) {
    await filters.getByRole("button", { name, exact: true }).click();
    assert.equal(await card.count(), name === "Sports" ? 0 : 1);
  }
  await page.goto(new URL("/meetups/demo-coffee", base).href);
  for (const label of ["Coffee", "Study"]) {
    await page.getByRole("main").getByText(label, { exact: true }).waitFor();
  }

  await page.goto(new URL("/explore", base).href);
  const mapFilters = page.getByRole("group", { name: "Filter meetups by category" });
  const marker = page.locator(`.maplibregl-marker[aria-label^="${testTitle} at "]`);
  for (const filter of ["All categories", "Coffee", "Study"]) {
    await mapFilters.getByRole("button", { name: filter, exact: true }).click();
    await marker.waitFor({ state: "attached" });
    assert.equal(await marker.count(), 1);
  }
  await mapFilters.getByRole("button", { name: "Sports", exact: true }).click();
  await marker.waitFor({ state: "detached" });
  console.log("PASS feed, detail badges, and Explore category membership");
} finally {
  await browser.close();
}
