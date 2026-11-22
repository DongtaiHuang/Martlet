"use client";

import { useEffect, useId, useRef, useState, useTransition } from "react";
import { GraduationCap, X } from "lucide-react";
import { addCourse, findCourses, removeCourse } from "@/app/profile/course-actions";
import { MAX_COURSES, normalizeCourseQuery, type Course } from "@/lib/course-codes";

/** Profile section where students search the McGill catalogue and save the courses they take (issue #25). */
export function CourseCodesForm({ initial }: { initial: Course[] }) {
  const [courses, setCourses] = useState(initial);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [message, setMessage] = useState("");
  const [pending, startTransition] = useTransition();
  const latestSearch = useRef(0);
  const id = useId();
  const listId = `${id}-results`;
  const full = courses.length >= MAX_COURSES;

  // Debounced search; ignores answers to older queries that arrive late.
  useEffect(() => {
    if (normalizeCourseQuery(query).length < 2) return;
    const search = ++latestSearch.current;
    const timer = setTimeout(async () => {
      const found = await findCourses(query);
      if (search !== latestSearch.current) return;
      setResults(found);
      setActiveIndex(found.length > 0 ? 0 : -1);
      setMessage(found.length > 0 ? `${found.length} matching courses. Use the arrow keys to choose.` : "No McGill course matches that.");
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function changeQuery(value: string) {
    setQuery(value);
    setMessage("");
    if (normalizeCourseQuery(value).length < 2) {
      latestSearch.current++;
      setResults([]);
      setActiveIndex(-1);
    }
  }

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
      changeQuery("");
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

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (results.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + results.length) % results.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      add(results[activeIndex]);
    } else if (event.key === "Escape") {
      changeQuery("");
    }
  }

  const open = results.length > 0;

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

      <div className="relative mt-3">
        <label htmlFor={`${id}-input`} className="sr-only">Add a course</label>
        <input
          id={`${id}-input`} type="text" role="combobox" autoComplete="off" spellCheck={false}
          value={query} onChange={(event) => changeQuery(event.target.value)} onKeyDown={onKeyDown}
          disabled={full} maxLength={60}
          placeholder={full ? `You’ve added ${MAX_COURSES} courses` : "Add a course, e.g. COMP 202 or Calculus"}
          aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={`${id}-hint ${id}-status`}
          className="min-h-11 w-full rounded-xl border border-stone-300 px-3 text-sm focus-visible:outline-2 focus-visible:outline-red-700 disabled:bg-stone-100"
        />
        <ul id={listId} role="listbox" aria-label="Matching McGill courses" hidden={!open}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {results.map((course, index) => (
            <li
              key={course.code} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()} onClick={() => add(course)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${index === activeIndex ? "bg-red-50 text-red-950" : "text-stone-800"}`}
            >
              <span className="font-semibold">{course.code}</span> <span className="text-stone-600">{course.title}</span>
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-status`} role="status" className="mt-1 min-h-5 text-xs text-stone-700">{message}</p>
    </section>
  );
}
