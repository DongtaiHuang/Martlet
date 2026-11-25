"use client";

import { startTransition, useActionState, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowRight } from "lucide-react";
import { submitMeetup, type CreateState } from "@/app/meetups/new/actions";
import { submitMeetupEdit } from "@/app/meetups/[id]/edit/actions";
import { MeetupCoursePicker } from "@/components/courses/MeetupCoursePicker";
import { MeetupCategoryPicker } from "./MeetupCategoryPicker";
import type { MeetupCategory } from "@/types/meetup";
import type { Course } from "@/lib/course-codes";
import { formatLocalMinute, futureLocalTimeToUtc } from "@/lib/local-date-time";
import { useFutureLocalTime } from "./useFutureLocalTime";
import { CAMPUS_LOCATIONS, getCampusLocation } from "@/lib/locations";
import { CUSTOM_LOCATION_MAX, UNMAPPED_LOCATION_NOTE } from "@/lib/meetup-location";
import { OTHER_LOCATION } from "@/lib/public-venues";
import { LocationPreview } from "./LocationPreview";
import { GooglePlaceSearch } from "./GooglePlaceSearch";
import { hasGoogleMaps } from "@/lib/google-maps";

const fieldStyle = "mt-2 block min-h-11 w-full min-w-0 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base text-ink focus-visible:outline-2 focus-visible:outline-focus aria-invalid:border-brand";

function FieldError({ name, fields }: { name: keyof NonNullable<CreateState["fields"]>; fields: CreateState["fields"] }) {
  const message = fields?.[name]?.[0];
  return message ? <p id={`${name}-error`} className="mt-1 text-sm text-brand-ink">{message}</p> : null;
}

/** Values for editing an existing meetup (issue #73). */
export interface MeetupFormInitial {
  title: string;
  description: string;
  categories: MeetupCategory[];
  locationId: string;
  customLocation: string;
  startsAt: string; // ISO; shown in the visitor's local time
  course: Course | null;
}

/** `preset` pre-fills a new meetup, e.g. from a Campus Board skill post (issue #118). */
export function MeetupForm({ myCourses = [], edit, preset }: { myCourses?: Course[]; edit?: { meetupId: string; initial: MeetupFormInitial }; preset?: { title?: string; categories?: MeetupCategory[] } }) {
  const action = useMemo(() => (edit ? submitMeetupEdit.bind(null, edit.meetupId) : submitMeetup), [edit]);
  const [state, dispatch, pending] = useActionState(action, {});
  const initial = edit?.initial;
  const [categories, setCategories] = useState<MeetupCategory[]>(initial?.categories ?? preset?.categories ?? []);
  const [initialCourse, setInitialCourse] = useState(initial?.course ?? null);
  const startsAtRef = useRef<HTMLInputElement>(null);
  // Show the saved start time in the visitor's own time zone (only known in the browser).
  useEffect(() => {
    if (initial?.startsAt && startsAtRef.current) startsAtRef.current.value = formatLocalMinute(Date.parse(initial.startsAt));
  }, [initial?.startsAt]);

  const { minimum, refreshMinimum } = useFutureLocalTime();
  const [timeError, setTimeError] = useState(false);
  const [locationId, setLocationId] = useState(initial?.locationId ?? "");
  const [customLocation, setCustomLocation] = useState(initial?.customLocation ?? "");
  const [showPlaceSearch, setShowPlaceSearch] = useState(false);
  const offCampus = locationId === OTHER_LOCATION;
  const location = getCampusLocation(locationId);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    refreshMinimum();
    const startsAt = futureLocalTimeToUtc(String(data.get("startsAt") ?? ""));
    if (!startsAt) {
      setTimeError(true);
      event.currentTarget.querySelector<HTMLInputElement>("#startsAt")?.focus();
      return;
    }
    setTimeError(false);
    data.set("startsAt", startsAt);
    startTransition(() => dispatch(data));
  }

  function fieldErrorProps(name: keyof NonNullable<CreateState["fields"]>) {
    const invalid = Boolean(state.fields?.[name]);
    return { "aria-invalid": invalid, "aria-describedby": invalid ? `${name}-error` : undefined };
  }

  return (
    <form action={dispatch} onSubmit={handleSubmit} onFocus={refreshMinimum} noValidate className="rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-8">
      <fieldset disabled={pending} className="min-w-0 space-y-5 disabled:opacity-70">
        <div>
          <label htmlFor="title" className="font-semibold">Title</label>
          <input id="title" name="title" required maxLength={80} defaultValue={initial?.title ?? preset?.title} placeholder="Coffee between classes" className={fieldStyle} {...fieldErrorProps("title")} />
          <FieldError name="title" fields={state.fields} />
        </div>
        <div>
          <label htmlFor="description" className="font-semibold">Description <span className="text-sm font-normal text-ink-subtle">(optional)</span></label>
          <textarea id="description" name="description" rows={4} maxLength={500} defaultValue={initial?.description} placeholder="What are you planning? How can people find you?" className={fieldStyle} {...fieldErrorProps("description")} />
          <FieldError name="description" fields={state.fields} />
        </div>
        <MeetupCategoryPicker value={categories} onChange={(next) => {
          setCategories(next);
          if (!next.includes("study")) setInitialCourse(null);
        }} error={state.fields?.categories?.[0]} />
        <div className="min-w-0">
          <label htmlFor="location" className="font-semibold">Meetup location</label>
          <select id="location" name="location" required value={locationId} onChange={(event) => setLocationId(event.target.value)} className={fieldStyle} {...fieldErrorProps("location")}>
            <option value="" disabled>Choose a location</option>
            {CAMPUS_LOCATIONS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
            <option value={OTHER_LOCATION}>Other — Outside McGill Campus</option>
          </select>
          <FieldError name="location" fields={state.fields} />
        </div>
        {offCampus && (
          <div className="min-w-0">
            <label htmlFor="customLocation" className="font-semibold">Where are you meeting?</label>
            <input
              id="customLocation" name="customLocation" required maxLength={CUSTOM_LOCATION_MAX}
              value={customLocation}
              onChange={(event) => { setCustomLocation(event.target.value); setShowPlaceSearch(false); }}
              placeholder="e.g. Café Olimpico, Mount Royal Park, or a specific meeting spot"
              className={fieldStyle}
              aria-invalid={Boolean(state.fields?.customLocation)}
              aria-describedby={state.fields?.customLocation ? "customLocation-hint customLocation-error" : "customLocation-hint"}
            />
            <p id="customLocation-hint" className="mt-1 text-sm text-ink-muted">Choose a public meeting spot and avoid sharing private residential addresses.</p>
            <FieldError name="customLocation" fields={state.fields} />
            <p className="mt-2 text-sm text-ink-muted">{UNMAPPED_LOCATION_NOTE}</p>
            {hasGoogleMaps && (
              <div className="mt-2">
                <button type="button" aria-expanded={showPlaceSearch} onClick={() => setShowPlaceSearch(!showPlaceSearch)}
                  className="min-h-11 text-sm font-semibold text-brand-ink underline">
                  {showPlaceSearch ? "Hide Google Maps lookup" : "Look up a place in Google Maps"}
                </button>
                {showPlaceSearch && <GooglePlaceSearch />}
              </div>
            )}
          </div>
        )}
        {location && <LocationPreview location={location} category={categories[0]} />}
        {categories.includes("study") && <MeetupCoursePicker myCourses={myCourses} initialCourse={initialCourse} error={state.fields?.course_code?.[0]} />}
        <div>
          <label htmlFor="startsAt" className="font-semibold">Start date and time</label>
          <input ref={startsAtRef} id="startsAt" name="startsAt" type="datetime-local" min={minimum} step={60} required className={fieldStyle} onChange={() => setTimeError(false)} aria-invalid={timeError || Boolean(state.fields?.startsAt)} aria-describedby={timeError || state.fields?.startsAt ? "startsAt-hint startsAt-error" : "startsAt-hint"} />
          <p id="startsAt-hint" className="mt-1 text-sm text-ink-muted">Use the local time shown on your device.</p>
          {timeError ? <p id="startsAt-error" role="alert" className="mt-1 text-sm text-brand-ink">Please select a future date and time.</p> : <FieldError name="startsAt" fields={state.fields} />}
        </div>
        {state.message && <p role="alert" className="rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand-ink-strong">{state.message}</p>}
        <button type="submit" className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-auto">
          {edit ? (pending ? "Saving changes…" : "Save changes") : (pending ? "Creating meetup…" : "Create meetup")} <ArrowRight aria-hidden="true" size={17} />
        </button>
      </fieldset>
    </form>
  );
}
