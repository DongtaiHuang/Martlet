import { AuthRequiredError, MockModeError } from "@/lib/meetups";
import { COURSE_CODE_PATTERN, MAX_COURSES, normalizeCourseQuery, type Course } from "@/lib/course-codes";
import { requireUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

// Server-only course service (issue #25). Courses need live Supabase: mock mode has no
// course catalogue, so reads return nothing and writes throw MockModeError.
// The user always comes from the session; RLS in 007_courses.sql is the real enforcement,
// and the foreign key to public.courses rejects codes that aren't real McGill courses.

export { AuthRequiredError, MockModeError };

export class CourseValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CourseValidationError";
  }
}

const SEARCH_LIMIT = 8;

/** Courses whose code starts with, or whose title contains, the query. "comp 2" → COMP 202, COMP 206… */
export async function searchCourses(query: string): Promise<Course[]> {
  const q = normalizeCourseQuery(query);
  if (q.length < 2 || getDataMode() === "mock") return [];
  await requireUser();

  const supabase = await createClient();
  // normalizeCourseQuery leaves only letters, digits and spaces, so q can't inject LIKE wildcards.
  const [byCode, byTitle] = await Promise.all([
    supabase.from("courses").select("code, title").ilike("code", `${q}%`).order("code").limit(SEARCH_LIMIT),
    supabase.from("courses").select("code, title").ilike("title", `%${q}%`).order("code").limit(SEARCH_LIMIT),
  ]);
  if (byCode.error) throw byCode.error;
  if (byTitle.error) throw byTitle.error;

  const results = new Map<string, Course>();
  for (const course of [...byCode.data, ...byTitle.data]) results.set(course.code, course);
  return [...results.values()].slice(0, SEARCH_LIMIT);
}

/** The signed-in student's courses, by code. Empty in mock mode. */
export async function listMyCourses(): Promise<Course[]> {
  if (getDataMode() === "mock") return [];
  const user = await requireUser();

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("user_courses")
    .select("course:courses!course_code(code, title)")
    .eq("user_id", user.id)
    .order("course_code");
  if (error) throw error;

  return data.flatMap((row) => {
    const course = Array.isArray(row.course) ? row.course[0] : row.course;
    return course ? [course] : [];
  });
}

export async function addMyCourse(code: string): Promise<void> {
  if (getDataMode() === "mock") throw new MockModeError("save courses");
  if (!COURSE_CODE_PATTERN.test(code)) throw new CourseValidationError("Pick a course from the list.");
  const user = await requireUser();

  const supabase = await createClient();
  const { count, error: countError } = await supabase
    .from("user_courses")
    .select("course_code", { count: "exact", head: true })
    .eq("user_id", user.id);
  if (countError) throw countError;
  if ((count ?? 0) >= MAX_COURSES) throw new CourseValidationError(`You can save up to ${MAX_COURSES} courses.`);

  const { error } = await supabase.from("user_courses").insert({ user_id: user.id, course_code: code });
  if (error?.code === "23505") return; // Already saved.
  if (error?.code === "23503") throw new CourseValidationError(`${code} isn’t a McGill course.`);
  if (error) throw error;
}

export async function removeMyCourse(code: string): Promise<void> {
  if (getDataMode() === "mock") throw new MockModeError("save courses");
  const user = await requireUser();

  const supabase = await createClient();
  const { error } = await supabase.from("user_courses").delete().eq("user_id", user.id).eq("course_code", code);
  if (error) throw error;
}
