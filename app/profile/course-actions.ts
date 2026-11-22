"use server";

import { revalidatePath } from "next/cache";
import type { Course } from "@/lib/course-codes";
import { addMyCourse, CourseValidationError, removeMyCourse, searchCourses } from "@/lib/courses";
import { AuthRequiredError } from "@/lib/supabase/auth";

export type CourseActionResult = { ok: true } | { ok: false; message: string };

export async function findCourses(query: string): Promise<Course[]> {
  if (typeof query !== "string" || query.length > 60) return [];
  try {
    return await searchCourses(query);
  } catch (error) {
    console.error("Course search failed", error);
    return [];
  }
}

async function run(change: () => Promise<void>, fallback: string): Promise<CourseActionResult> {
  try {
    await change();
  } catch (error) {
    if (error instanceof CourseValidationError) return { ok: false, message: error.message };
    if (error instanceof AuthRequiredError) return { ok: false, message: "Sign in to change your courses." };
    console.error(fallback, error);
    return { ok: false, message: fallback };
  }
  // The feed's Study filter uses these courses too.
  revalidatePath("/profile");
  revalidatePath("/meetups");
  return { ok: true };
}

export async function addCourse(code: string): Promise<CourseActionResult> {
  if (typeof code !== "string") return { ok: false, message: "Pick a course from the list." };
  return run(() => addMyCourse(code), "Couldn’t add that course. Try again.");
}

export async function removeCourse(code: string): Promise<CourseActionResult> {
  if (typeof code !== "string") return { ok: false, message: "Couldn’t remove that course." };
  return run(() => removeMyCourse(code), "Couldn’t remove that course. Try again.");
}
