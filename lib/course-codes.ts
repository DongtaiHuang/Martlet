// Client-safe helpers for McGill course codes (issue #25). The real list of courses lives in
// public.courses (supabase/migrations/007_courses.sql); lib/courses.ts is the server service.

/** Matches public.courses.code, e.g. "COMP 202", "ACCT 645D1", "NUR1 422". */
export const COURSE_CODE_PATTERN = /^[A-Z][A-Z0-9]{2,3} [0-9]{3}[A-Z0-9]{0,3}$/;

/** UX limit on how many courses a student can save. */
export const MAX_COURSES = 12;

export interface Course {
  code: string;
  title: string;
}

/**
 * Tidies what a student typed: "comp202" → "COMP 202", "  math  140 " → "MATH 140".
 * Keeps only letters, digits and single spaces, so it is safe to use in a LIKE pattern.
 */
export function normalizeCourseQuery(query: string): string {
  const cleaned = query.toUpperCase().replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  // Insert the missing space in "COMP202" or "NUR1422" (a 3-letter subject may end in a digit).
  const glued = /^([A-Z]{4}|[A-Z]{3}[0-9])([0-9]{1,3}[A-Z0-9]{0,3})$/.exec(cleaned);
  return glued ? `${glued[1]} ${glued[2]}` : cleaned;
}

/** "ACCT 645D1" → "ACCT 645", so multi-term parts match the base course. */
function baseCode(code: string): string {
  return code.slice(0, code.indexOf(" ") + 4);
}

const MENTIONED_CODE = /\b([A-Z]{4}|[A-Z]{3}[0-9])[ -]?([0-9]{3})(?![0-9])/g;

/** True when the text mentions one of the courses, e.g. a meetup titled "comp 202 midterm review". */
export function mentionsAnyCourse(text: string, courseCodes: readonly string[]): boolean {
  if (courseCodes.length === 0) return false;
  const wanted = new Set(courseCodes.map(baseCode));
  for (const [, subject, number] of text.toUpperCase().matchAll(MENTIONED_CODE)) {
    if (wanted.has(`${subject} ${number}`)) return true;
  }
  return false;
}
