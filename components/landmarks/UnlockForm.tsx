"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { Camera, Info } from "lucide-react";
import type { UnlockState } from "@/app/landmarks/[id]/actions";
import { announceAchievement } from "@/components/achievements/earn";
import { FilePreview } from "@/components/forms/FilePreview";
import { prepareLandmarkPhoto } from "@/lib/landmark-photo";

const CAPTION_MAX = 200;

interface UnlockFormProps {
  action: (state: UnlockState, formData: FormData) => Promise<UnlockState>;
  /** True when the user already unlocked this landmark (the form then modifies it). */
  unlocked: boolean;
  currentCaption: string;
}

/** Create or modify the current user's unlock. There is intentionally no delete (ADR 0009). */
export function UnlockForm({ action, unlocked, currentCaption }: UnlockFormProps) {
  const [state, dispatch, pending] = useActionState(action, {});
  const [file, setFile] = useState<File | null>(null);
  const [localError, setLocalError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [handledState, setHandledState] = useState(state);
  const [fileInputKey, setFileInputKey] = useState(0);
  const busy = pending || preparing;

  useEffect(() => {
    if (state.achievement) announceAchievement(state.achievement, true);
  }, [state.achievement]);

  // After a successful save, clear the chosen file (adjusting state during render,
  // instead of in an effect; the new key resets the file input).
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setFile(null);
      setFileInputKey((key) => key + 1);
    }
  }

  function onFileChange(selected: File | null) {
    setLocalError("");
    setFile(selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setLocalError("");
    if (!unlocked && !file) {
      setLocalError("Add a photo of yourself doing the challenge to unlock this landmark.");
      return;
    }

    const data = new FormData();
    data.set("caption", String(new FormData(event.currentTarget).get("caption") ?? ""));
    if (file) {
      setPreparing(true);
      try {
        data.set("photo", await prepareLandmarkPhoto(file), "photo.jpg");
      } catch (error) {
        setLocalError(error instanceof Error ? error.message : "Couldn't process the photo.");
        return;
      } finally {
        setPreparing(false);
      }
    }
    startTransition(() => dispatch(data));
  }

  const error = localError || state.error;

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-4">
      <fieldset disabled={busy} className="min-w-0 space-y-4 disabled:opacity-70">
        <div>
          <label htmlFor="landmark-photo" className="block text-sm font-bold text-ink-soft">
            {unlocked ? "Replace your photo (optional)" : "Your photo"}
          </label>
          <label
            htmlFor="landmark-photo"
            className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong bg-canvas px-4 py-4 text-sm font-semibold text-ink-2 hover:border-brand focus-within:outline-2 focus-within:outline-focus"
          >
            <Camera aria-hidden="true" size={18} />
            {file ? file.name : "Take or choose a photo"}
          </label>
          <input
            key={fileInputKey}
            id="landmark-photo"
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => onFileChange(event.target.files?.[0] ?? null)}
          />
          {file && <FilePreview file={file} label="Preview of the photo you chose" className="mx-auto mt-3 block max-h-72 rounded-xl" />}
        </div>

        <div>
          <label htmlFor="landmark-caption" className="block text-sm font-bold text-ink-soft">Caption (optional)</label>
          <input
            id="landmark-caption"
            name="caption"
            defaultValue={currentCaption}
            maxLength={CAPTION_MAX}
            placeholder="Say something about your visit"
            className="mt-2 block w-full min-w-0 rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-base text-ink focus-visible:outline-2 focus-visible:outline-focus"
          />
        </div>

        <p className="flex gap-2 rounded-xl bg-warn-soft p-3 text-sm text-warn-ink">
          <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>
            Your photo is visible to everyone who has unlocked this landmark. <strong>Unlocks are permanent:</strong> you
            can change your photo or caption later, but you can&apos;t remove the unlock.
          </span>
        </p>

        {error && <p role="alert" className="rounded-lg border border-brand-line bg-brand-soft p-3 text-sm text-brand-ink">{error}</p>}
        {state.success && !error && <p role="status" className="rounded-lg border border-ok-line bg-ok-soft p-3 text-sm text-ok-ink">{state.success}</p>}
        {state.achievementWarning && !error && <p role="status" className="rounded-lg border border-warn-line bg-warn-soft p-3 text-sm text-warn-ink">{state.achievementWarning}</p>}

        <button type="submit" className="w-full rounded-xl bg-brand px-5 py-3 font-semibold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus sm:w-auto">
          {preparing ? "Preparing photo…" : pending ? "Saving…" : unlocked ? "Save changes" : "Unlock landmark"}
        </button>
      </fieldset>
    </form>
  );
}
