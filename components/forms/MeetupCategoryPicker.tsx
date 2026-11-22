"use client";

import { Check } from "lucide-react";
import { useId } from "react";
import { categories, categoryValues } from "@/components/feed/categories";
import { MAX_MEETUP_CATEGORIES, type MeetupCategory } from "@/lib/meetup-categories";

const descriptions: Record<MeetupCategory, string> = {
  coffee: "Café chats and quick breaks",
  study: "Coursework and study groups",
  food: "Meals and snacks together",
  sports: "Games, workouts, and walks",
  gaming: "Video and tabletop games",
  other: "Something different",
};

export function MeetupCategoryPicker({ value, onChange, error }: {
  value: MeetupCategory[];
  onChange: (value: MeetupCategory[]) => void;
  error?: string;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const otherSelected = value.includes("other");

  return (
    <fieldset className="min-w-0" aria-describedby={error ? `${hintId} ${errorId}` : hintId} aria-invalid={Boolean(error)}>
      <legend className="font-semibold">Categories</legend>
      <p id={hintId} className="mt-1 text-sm text-ink-muted">
        Choose one to three. Your first choice sets the card and map color. Choose Other on its own.
      </p>
      <p role="status" className="mt-1 text-sm font-semibold text-ink-2">{value.length} of {MAX_MEETUP_CATEGORIES} selected</p>
      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
        {categoryValues.map((category) => {
          const { label, icon: Icon } = categories[category];
          const selected = value.includes(category);
          const disabled = !selected && (value.length === MAX_MEETUP_CATEGORIES || otherSelected
            || (category === "other" && value.length > 0));
          return (
            <label key={category} className="relative block min-w-0">
              <input
                type="checkbox"
                checked={selected}
                disabled={disabled}
                aria-labelledby={`${id}-${category}-label`}
                aria-describedby={`${id}-${category}`}
                className="peer sr-only"
                onChange={() => onChange(selected ? value.filter((item) => item !== category) : [...value, category])}
              />
              <span className="flex h-full min-h-24 cursor-pointer flex-col gap-1 rounded-xl border border-line-strong bg-surface p-3 hover:border-brand-line peer-checked:border-brand peer-checked:bg-brand-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-focus peer-disabled:cursor-not-allowed peer-disabled:opacity-60">
                <span className="flex items-center justify-between gap-1">
                  <Icon aria-hidden="true" size={19} className="text-brand-ink" />
                  {selected && <Check aria-hidden="true" size={16} className="text-brand-ink" />}
                </span>
                <span id={`${id}-${category}-label`} className="text-sm font-bold">{label}</span>
                <span id={`${id}-${category}`} className="text-xs leading-4 text-ink-muted">{descriptions[category]}</span>
              </span>
            </label>
          );
        })}
      </div>
      {/* Submit selections in the order they were chosen. */}
      {value.map((category) => <input key={category} type="hidden" name="categories" value={category} />)}
      {error && <p id={errorId} role="alert" className="mt-2 text-sm text-brand-ink">{error}</p>}
    </fieldset>
  );
}
