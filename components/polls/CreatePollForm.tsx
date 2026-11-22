"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { MeetupStartTime } from "@/app/meetups/[id]/MeetupStartTime";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { formatLocalMinute, futureLocalTimeToUtc } from "@/lib/local-date-time";
import { useFutureLocalTime } from "@/components/forms/useFutureLocalTime";
import type { PollType } from "@/types/poll";
import { submitPoll } from "./actions";

const field = "mt-1 block w-full min-w-0 rounded-lg border border-line-strong bg-surface px-3 py-2 text-base";
const secondary = "min-h-11 rounded-lg px-3 text-sm font-bold text-brand-ink hover:bg-brand-soft focus-visible:outline-2 focus-visible:outline-focus";

export function CreatePollForm({ meetupId, startsAt }: { meetupId: string; startsAt: string }) {
  const [type, setType] = useState<PollType>("activity");
  const [options, setOptions] = useState(["", ""]);
  const [state, dispatch, pending] = useActionState(submitPoll.bind(null, meetupId), {});

  const { minimum, refreshMinimum } = useFutureLocalTime();
  const maximumDeadline = minimum ? formatLocalMinute(Date.parse(startsAt)) : undefined;
  const [timeError, setTimeError] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    refreshMinimum();
    const now = Date.now();
    const closesAt = futureLocalTimeToUtc(String(data.get("closesAt") ?? ""), now);
    if (!closesAt || Date.parse(closesAt) > Date.parse(startsAt)) {
      setTimeError("Choose a future voting deadline no later than the meetup start.");
      return;
    }
    data.set("closesAt", closesAt);
    if (type === "time") {
      const utcOptions = options.map((choice) => futureLocalTimeToUtc(choice, now));
      if (utcOptions.some((choice) => !choice)) {
        setTimeError("Choose a future date and time for each option.");
        return;
      }
      data.delete("option");
      for (const choice of utcOptions) data.append("option", choice);
    }
    setTimeError("");
    startTransition(() => dispatch(data));
  }

  function updateChoice(index: number, value: string) {
    setOptions((current) => current.map((choice, i) => i === index ? value : choice));
  }

  return (
    <details>
      <summary className="w-fit cursor-pointer rounded-lg px-1 py-2 font-bold text-brand-ink focus-visible:outline-2 focus-visible:outline-focus">Create a poll</summary>
      <form action={dispatch} onSubmit={handleSubmit} onFocus={refreshMinimum} onChange={() => setTimeError("")} className="mt-2">
        <fieldset disabled={pending} className="min-w-0 space-y-4 disabled:opacity-70">
          <label className="block text-sm font-semibold">Poll type
            <select name="type" className={field} value={type} onChange={(event) => {
              setType(event.target.value as PollType);
              setOptions(["", ""]);
            }}>
              <option value="activity">Activity</option>
              <option value="location">Location</option>
              <option value="time">Time</option>
            </select>
          </label>
          <label className="block text-sm font-semibold">Question
            <input name="question" className={field} minLength={5} maxLength={120} required placeholder="What should we do?" />
          </label>
          <fieldset className="min-w-0 space-y-2">
            <legend className="text-sm font-semibold">Choices</legend>
            {options.map((choice, index) => (
              <div key={index} className="flex min-w-0 items-end gap-2">
                <label className="min-w-0 flex-1 text-xs font-medium text-ink-2">
                  Choice {index + 1}
                  {type === "location" ? (
                    <select name="option" className={field} value={choice} onChange={(event) => updateChoice(index, event.target.value)} required>
                      <option value="">Choose a campus location</option>
                      {CAMPUS_LOCATIONS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                    </select>
                  ) : (
                    <input name="option" type={type === "time" ? "datetime-local" : "text"} min={type === "time" ? minimum : undefined} className={field} value={choice} maxLength={80} onChange={(event) => updateChoice(index, event.target.value)} required />
                  )}
                </label>
                {options.length > 2 && <button type="button" aria-label={`Remove choice ${index + 1}`} className={secondary} onClick={() => setOptions(options.filter((_, i) => i !== index))}>Remove</button>}
              </div>
            ))}
            {options.length < 5 && <button type="button" className={secondary} onClick={() => setOptions([...options, ""])}>Add choice</button>}
          </fieldset>
          <label className="block text-sm font-semibold">Voting closes
            <input name="closesAt" type="datetime-local" min={minimum} max={maximumDeadline} aria-describedby="poll-deadline-hint" className={field} required />
          </label>
          <p id="poll-deadline-hint" className="text-sm text-ink-muted">Use your device’s local time. Close voting by the meetup start on <MeetupStartTime startsAt={startsAt} />.</p>
          {(timeError || state.error) && <p role="alert" className="text-sm text-brand-ink-strong">{timeError || state.error}</p>}
          <button type="submit" className="min-h-11 rounded-lg bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
            {pending ? "Creating poll…" : "Publish poll"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
