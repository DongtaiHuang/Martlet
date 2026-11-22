"use client";

import { useState } from "react";
import { GraduationCap, X } from "lucide-react";
import type { Course } from "@/lib/course-codes";
import { CourseSearch } from "./CourseSearch";

/**
 * Optional course for a study meetup (issue #25). Submits the code as `course_code`;
 * the server re-validates it and the database only accepts real McGill courses.
 */
export function MeetupCoursePicker({ myCourses, error, initialCourse = null }: { myCourses: Course[]; error?: string; initialCourse?: Course | null }) {
  const [selected, setSelected] = useState<Course | null>(initialCourse);

  return (
    <fieldset className="min-w-0">
      <legend className="font-semibold">Course <span className="text-sm font-normal text-stone-500">(optional)</span></legend>
      <p id="course_code-hint" className="mt-1 text-sm text-stone-600">Classmates who added this course see your meetup under Study → My courses.</p>
      {selected && <input type="hidden" name="course_code" value={selected.code} />}

      {selected ? (
        <p className="mt-2 inline-flex min-h-11 max-w-full items-center gap-2 rounded-xl bg-red-50 py-1 pr-1 pl-3 text-sm text-red-950 ring-1 ring-red-200">
          <GraduationCap aria-hidden="true" size={16} className="shrink-0" />
          <span className="min-w-0 truncate"><strong>{selected.code}</strong> {selected.title}</span>
          <button type="button" onClick={() => setSelected(null)} aria-label={`Remove course ${selected.code}`}
            className="grid size-9 shrink-0 place-items-center rounded-lg hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-700">
            <X aria-hidden="true" size={16} />
          </button>
        </p>
      ) : (
        <>
          {myCourses.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2" role="group" aria-label="Your courses">
              {myCourses.map((course) => (
                <button key={course.code} type="button" onClick={() => setSelected(course)} title={course.title}
                  className="min-h-11 rounded-full border border-stone-200 bg-white px-3.5 text-sm font-semibold text-stone-700 hover:border-red-300 hover:text-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
                  {course.code}
                </button>
              ))}
            </div>
          )}
          <div className="mt-2">
            <CourseSearch label="Search McGill courses" onPick={setSelected} describedBy="course_code-hint"
              placeholder={myCourses.length > 0 ? "Or search another course" : "Search, e.g. COMP 202 or Calculus"} />
          </div>
        </>
      )}
      {error && <p id="course_code-error" className="mt-1 text-sm text-red-800">{error}</p>}
    </fieldset>
  );
}
