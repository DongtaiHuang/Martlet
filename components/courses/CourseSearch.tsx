"use client";

import { useEffect, useId, useRef, useState } from "react";
import { findCourses } from "@/app/profile/course-actions";
import { normalizeCourseQuery, type Course } from "@/lib/course-codes";

type CourseSearchProps = {
  label: string;
  onPick: (course: Course) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Extra ids for aria-describedby, e.g. a hint above the field. */
  describedBy?: string;
};

/** Accessible search-as-you-type over the McGill course catalogue (public.courses). */
export function CourseSearch({ label, onPick, placeholder = "e.g. COMP 202 or Calculus", disabled = false, describedBy }: CourseSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Course[]>([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [status, setStatus] = useState("");
  const latestSearch = useRef(0);
  const id = useId();
  const listId = `${id}-results`;
  const open = results.length > 0;

  // Debounced search; ignores answers to older queries that arrive late.
  useEffect(() => {
    if (normalizeCourseQuery(query).length < 2) return;
    const search = ++latestSearch.current;
    const timer = setTimeout(async () => {
      const found = await findCourses(query);
      if (search !== latestSearch.current) return;
      setResults(found);
      setActiveIndex(found.length > 0 ? 0 : -1);
      setStatus(found.length > 0 ? `${found.length} matching courses. Use the arrow keys to choose.` : "No McGill course matches that.");
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  function changeQuery(value: string) {
    setQuery(value);
    if (normalizeCourseQuery(value).length < 2) {
      latestSearch.current++;
      setResults([]);
      setActiveIndex(-1);
      setStatus("");
    }
  }

  function pick(course: Course) {
    onPick(course);
    changeQuery("");
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape") return changeQuery("");
    if (!open) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => (index + step + results.length) % results.length);
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault(); // Don't submit the surrounding form.
      pick(results[activeIndex]);
    }
  }

  return (
    <div>
      <div className="relative">
        <label htmlFor={`${id}-input`} className="sr-only">{label}</label>
        <input
          id={`${id}-input`} type="text" role="combobox" autoComplete="off" spellCheck={false}
          value={query} onChange={(event) => changeQuery(event.target.value)} onKeyDown={onKeyDown}
          disabled={disabled} maxLength={60} placeholder={placeholder}
          aria-expanded={open} aria-controls={listId} aria-autocomplete="list"
          aria-activedescendant={open && activeIndex >= 0 ? `${listId}-${activeIndex}` : undefined}
          aria-describedby={[describedBy, `${id}-status`].filter(Boolean).join(" ")}
          className="min-h-11 w-full rounded-xl border border-stone-300 bg-white px-3 text-base text-stone-950 focus-visible:outline-2 focus-visible:outline-red-700 disabled:bg-stone-100 sm:text-sm"
        />
        <ul id={listId} role="listbox" aria-label="Matching McGill courses" hidden={!open}
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-72 overflow-y-auto rounded-xl border border-stone-200 bg-white py-1 shadow-lg">
          {results.map((course, index) => (
            <li
              key={course.code} id={`${listId}-${index}`} role="option" aria-selected={index === activeIndex}
              onMouseDown={(event) => event.preventDefault()} onClick={() => pick(course)}
              onMouseEnter={() => setActiveIndex(index)}
              className={`cursor-pointer px-3 py-2 text-sm ${index === activeIndex ? "bg-red-50 text-red-950" : "text-stone-800"}`}
            >
              <span className="font-semibold">{course.code}</span> <span className="text-stone-600">{course.title}</span>
            </li>
          ))}
        </ul>
      </div>
      <p id={`${id}-status`} role="status" className="mt-1 min-h-5 text-xs text-stone-700">{status}</p>
    </div>
  );
}
