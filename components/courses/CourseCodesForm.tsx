"use client";

import { useId, useState, useTransition } from "react";
import { GraduationCap, X } from "lucide-react";
import { addCourse, removeCourse } from "@/app/profile/course-actions";
import { MAX_COURSES, type Course } from "@/lib/course-codes";
import { CourseSearch } from "./CourseSearch";

/** Profile section where students search the McGill catalogue and save the courses they take (issue #25). */
export function CourseCodesForm({ initial }: { initial: Course[] }) {
  const [courses, setCourses] = useState(initial);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const id = useId();
  const full = courses.length >= MAX_COURSES;

  function add(course: Course) {
    if (courses.some((c) => c.code === course.code)) {
      setMessage(`${course.code} is already in your courses.`);
      return;
    }
    startTransition(async () => {
      const result = await addCourse(course.code);
      if (!result.ok) return setMessage(result.message);
      setCourses((current) => [...current, course].sort((a, b) => a.code.localeCompare(b.code)));
      setMessage(`Added ${course.code}.`);
    });
  }

  function remove(course: Course) {
    startTransition(async () => {
      const result = await removeCourse(course.code);
      if (!result.ok) return setMessage(result.message);
      setCourses((current) => current.filter((c) => c.code !== course.code));
      setMessage(`Removed ${course.code}.`);
    });
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="mt-5 border-t border-stone-100 pt-4">
      <h3 id={`${id}-heading`} className="flex items-center gap-2 text-sm font-semibold">
        <GraduationCap aria-hidden="true" size={16} className="text-red-800" /> Your courses
      </h3>
      <p id={`${id}-hint`} className="text-xs text-stone-600">
        Only you can see these. They’re used to show study meetups for your courses.
      </p>

      {courses.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {courses.map((course) => (
            <li key={course.code} className="inline-flex min-h-9 items-center gap-1 rounded-full bg-red-50 py-1 pr-1 pl-3 text-sm text-red-950 ring-1 ring-red-200">
              <span title={course.title} className="font-semibold">{course.code}</span>
              <button
                type="button" onClick={() => remove(course)} disabled={pending}
                aria-label={`Remove ${course.code}, ${course.title}`}
                className="grid size-7 place-items-center rounded-full hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-700 disabled:opacity-60"
              >
                <X aria-hidden="true" size={14} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3">
        <CourseSearch
          label="Add a course" onPick={add} disabled={full} describedBy={`${id}-hint ${id}-status`}
          placeholder={full ? `You’ve added ${MAX_COURSES} courses` : "Add a course, e.g. COMP 202 or Calculus"}
        />
      </div>
      <p id={`${id}-status`} role="status" className="min-h-5 text-xs text-stone-700">{message}</p>
    </section>
  );
}
