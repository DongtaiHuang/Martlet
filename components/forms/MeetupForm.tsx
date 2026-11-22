"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { submitMeetup, type CreateState } from "@/app/meetups/new/actions";
import { MeetupCoursePicker } from "@/components/courses/MeetupCoursePicker";
import { categories, categoryValues } from "@/components/feed/categories";
import type { Course } from "@/lib/course-codes";
import { CAMPUS_LOCATIONS } from "@/lib/locations";

const fieldStyle = "mt-2 block w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-950 focus-visible:outline-2 focus-visible:outline-red-700 aria-invalid:border-red-700";

function FieldError({ name, fields }: { name: keyof NonNullable<CreateState["fields"]>; fields: CreateState["fields"] }) {
  const message = fields?.[name]?.[0];
  return message ? <p id={`${name}-error`} className="mt-1 text-sm text-red-800">{message}</p> : null;
}

export function MeetupForm({ myCourses = [] }: { myCourses?: Course[] }) {
  const [state, dispatch, pending] = useActionState(submitMeetup, {});
  const [category, setCategory] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    const localTime = String(data.get("startsAt") ?? "");
    const date = new Date(localTime);
    if (Number.isFinite(date.getTime())) {
      // A datetime-local input is in the visitor's timezone. Send an absolute UTC instant.
      const normalized = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString();
      if (normalized.startsWith(localTime)) data.set("startsAt", date.toISOString());
    }
    startTransition(() => dispatch(data));
  }

  function fieldErrorProps(name: keyof NonNullable<CreateState["fields"]>) {
    const invalid = Boolean(state.fields?.[name]);
    return { "aria-invalid": invalid, "aria-describedby": invalid ? `${name}-error` : undefined };
  }

  return (
    <form action={dispatch} onSubmit={handleSubmit} noValidate className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm sm:p-8">
      <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-70">
        <div>
          <label htmlFor="title" className="font-semibold">Title</label>
          <input id="title" name="title" required maxLength={80} placeholder="Coffee between classes" className={fieldStyle} {...fieldErrorProps("title")} />
          <FieldError name="title" fields={state.fields} />
        </div>
        <div>
          <label htmlFor="description" className="font-semibold">Description <span className="text-sm font-normal text-stone-500">(optional)</span></label>
          <textarea id="description" name="description" rows={4} maxLength={500} placeholder="What are you planning? How can people find you?" className={fieldStyle} {...fieldErrorProps("description")} />
          <FieldError name="description" fields={state.fields} />
        </div>
        <div className="grid min-w-0 gap-5 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="category" className="font-semibold">Category</label>
            <select id="category" name="category" required value={category} onChange={(event) => setCategory(event.target.value)} className={fieldStyle} {...fieldErrorProps("category")}>
              <option value="" disabled>Choose a category</option>
              {categoryValues.map((category) => <option key={category} value={category}>{categories[category].label}</option>)}
            </select>
            <FieldError name="category" fields={state.fields} />
          </div>
          <div className="min-w-0">
            <label htmlFor="location" className="font-semibold">Campus location</label>
            <select id="location" name="location" required defaultValue="" className={fieldStyle} {...fieldErrorProps("location")}>
              <option value="" disabled>Choose a location</option>
              {CAMPUS_LOCATIONS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            </select>
            <FieldError name="location" fields={state.fields} />
          </div>
        </div>
        {category === "study" && <MeetupCoursePicker myCourses={myCourses} error={state.fields?.course_code?.[0]} />}
        <div>
          <label htmlFor="startsAt" className="font-semibold">Start date and time</label>
          <input id="startsAt" name="startsAt" type="datetime-local" required className={fieldStyle} {...fieldErrorProps("startsAt")} aria-describedby={state.fields?.startsAt ? "startsAt-hint startsAt-error" : "startsAt-hint"} />
          <p id="startsAt-hint" className="mt-1 text-sm text-stone-600">Use the local time shown on your device.</p>
          <FieldError name="startsAt" fields={state.fields} />
        </div>
        {state.message && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-900">{state.message}</p>}
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-800 px-5 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:w-auto">
          {pending ? "Creating meetup…" : "Create meetup"} <ArrowRight aria-hidden="true" size={17} />
        </button>
      </fieldset>
    </form>
  );
}
