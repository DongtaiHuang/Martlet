// One-time import of McGill course codes and titles from the official course catalogue.
// Rerun once per academic year to pick up new courses:
//
//   node scripts/import-mcgill-courses.mjs            (downloads the catalogue index)
//   node scripts/import-mcgill-courses.mjs page.html  (parses a saved copy instead)
//
// Writes data/mcgill-courses.json and the seed migration supabase/migrations/008_course_catalog.sql.
// It makes a single request to the catalogue's course index (allowed by its robots.txt).

import { readFile, writeFile, mkdir } from "node:fs/promises";

const INDEX_URL = "https://coursecatalogue.mcgill.ca/courses/";
const JSON_OUT = "data/mcgill-courses.json";
const SQL_OUT = "supabase/migrations/008_course_catalog.sql";

// Matches the database check constraint in 007_courses.sql, e.g. "COMP 202", "ACCT 645D1", "NUR1 422".
const CODE_PATTERN = /^[A-Z][A-Z0-9]{2,3} [0-9]{3}[A-Z0-9]{0,3}$/;

const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#[0-9]+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === "#") {
      const codePoint = entity[1].toLowerCase() === "x" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return String.fromCodePoint(codePoint);
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

async function loadIndex(localPath) {
  if (localPath) return readFile(localPath, "utf8");
  const response = await fetch(INDEX_URL, { headers: { "User-Agent": "martlet-course-import/1.0 (student project)" } });
  if (!response.ok) throw new Error(`Catalogue returned HTTP ${response.status}`);
  return response.text();
}

function parseCourses(html) {
  const courses = new Map();
  const skipped = [];
  for (const [, label] of html.matchAll(/<a href="\/courses\/[a-z0-9-]+\/?">([^<]+)<\/a>/g)) {
    const text = decodeEntities(label).replace(/\s+/g, " ").trim();
    const separator = text.indexOf(" - ");
    const code = separator === -1 ? "" : text.slice(0, separator).trim();
    const title = separator === -1 ? "" : text.slice(separator + 3).trim().replace(/\.$/, "").trim();
    if (!CODE_PATTERN.test(code) || !title) {
      skipped.push(text);
      continue;
    }
    courses.set(code, title);
  }
  const list = [...courses].map(([code, title]) => ({ code, title })).sort((a, b) => a.code.localeCompare(b.code));
  return { list, skipped };
}

const sqlString = (value) => `'${value.replaceAll("'", "''")}'`;

function toMigration(courses, sourceDate) {
  const rows = courses.map(({ code, title }) => `  (${sqlString(code)}, ${sqlString(title)})`).join(",\n");
  return `-- McGill course catalogue (${courses.length} courses), generated ${sourceDate} by
-- scripts/import-mcgill-courses.mjs from ${INDEX_URL}
-- Do not edit by hand: rerun the script. Run after 007_courses.sql. Safe to re-run.
-- Courses dropped from the catalogue are kept, so saved user courses stay valid.

insert into public.courses (code, title)
values
${rows}
on conflict (code) do update set title = excluded.title;
`;
}

const html = await loadIndex(process.argv[2]);
const { list, skipped } = parseCourses(html);
if (list.length < 1000) throw new Error(`Only ${list.length} courses parsed; the catalogue layout may have changed.`);

const today = new Date().toISOString().slice(0, 10);
await mkdir("data", { recursive: true });
await writeFile(JSON_OUT, `${JSON.stringify({ source: INDEX_URL, generated: today, courses: list }, null, 1)}\n`);
await writeFile(SQL_OUT, toMigration(list, today));

console.log(`Wrote ${list.length} courses to ${JSON_OUT} and ${SQL_OUT}.`);
if (skipped.length) console.log(`Skipped ${skipped.length} links that are not courses, e.g.:`, skipped.slice(0, 5));
