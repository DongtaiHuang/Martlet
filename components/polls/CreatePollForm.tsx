"use client";

import { startTransition, useActionState, useState, type FormEvent } from "react";
import { MeetupStartTime } from "@/app/meetups/[id]/MeetupStartTime";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import { localPollTimeToUtc } from "@/lib/poll-validation";
import type { PollType } from "@/types/poll";
import { submitPoll } from "./actions";

const field = "mt-1 block w-full min-w-0 rounded-lg border border-stone-300 bg-white px-3 py-2 text-base";
const secondary = "min-h-11 rounded-lg px-3 text-sm font-bold text-red-800 hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-red-700";

export function CreatePollForm({ meetupId, startsAt }: { meetupId: string; startsAt: string }) {
  const [type, setType] = useState<PollType>("activity");
  const [options, setOptions] = useState(["", ""]);
  const [state, dispatch, pending] = useActionState(submitPoll.bind(null, meetupId), {});

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    data.set("closesAt", localPollTimeToUtc(String(data.get("closesAt") ?? "")));
    if (type === "time") {
      data.delete("option");
      for (const choice of options) data.append("option", localPollTimeToUtc(choice));
    }
    startTransition(() => dispatch(data));
  }

  function updateChoice(index: number, value: string) {
    setOptions((current) => current.map((choice, i) => i === index ? value : choice));
  }

  return (
    <details>
      <summary className="w-fit cursor-pointer rounded-lg px-1 py-2 font-bold text-red-800 focus-visible:outline-2 focus-visible:outline-red-700">Create a poll</summary>
      <form action={dispatch} onSubmit={handleSubmit} className="mt-2">
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
                <label className="min-w-0 flex-1 text-xs font-medium text-stone-700">
                  Choice {index + 1}
                  {type === "location" ? (
                    <select name="option" className={field} value={choice} onChange={(event) => updateChoice(index, event.target.value)} required>
                      <option value="">Choose a campus location</option>
                      {CAMPUS_LOCATIONS.map(({ id, name }) => <option key={id} value={id}>{name}</option>)}
                    </select>
                  ) : (
                    <input name="option" type={type === "time" ? "datetime-local" : "text"} className={field} value={choice} maxLength={80} onChange={(event) => updateChoice(index, event.target.value)} required />
                  )}
                </label>
                {options.length > 2 && <button type="button" aria-label={`Remove choice ${index + 1}`} className={secondary} onClick={() => setOptions(options.filter((_, i) => i !== index))}>Remove</button>}
              </div>
            ))}
            {options.length < 5 && <button type="button" className={secondary} onClick={() => setOptions([...options, ""])}>Add choice</button>}
          </fieldset>
          <label className="block text-sm font-semibold">Voting closes
            <input name="closesAt" type="datetime-local" aria-describedby="poll-deadline-hint" className={field} required />
          </label>
          <p id="poll-deadline-hint" className="text-sm text-stone-600">Use your device’s local time. Close voting by the meetup start on <MeetupStartTime startsAt={startsAt} />.</p>
          {state.error && <p role="alert" className="text-sm text-red-900">{state.error}</p>}
          <button type="submit" className="min-h-11 rounded-lg bg-red-800 px-4 text-sm font-bold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700">
            {pending ? "Creating poll…" : "Publish poll"}
          </button>
        </fieldset>
      </form>
    </details>
  );
}
