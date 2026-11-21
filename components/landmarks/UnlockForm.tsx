"use client";

import { startTransition, useActionState, useEffect, useState, type FormEvent } from "react";
import { Camera, Info } from "lucide-react";
import type { UnlockState } from "@/app/landmarks/[id]/actions";
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
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [handledState, setHandledState] = useState(state);
  const [fileInputKey, setFileInputKey] = useState(0);
  const busy = pending || preparing;

  // Free the preview object URL when it changes or the form unmounts.
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  // After a successful save, clear the chosen file (adjusting state during render,
  // instead of in an effect; the new key resets the file input).
  if (state !== handledState) {
    setHandledState(state);
    if (state.success) {
      setFile(null);
      setPreview(null);
      setFileInputKey((key) => key + 1);
    }
  }

  function onFileChange(selected: File | null) {
    setLocalError("");
    setFile(selected);
    setPreview(selected ? URL.createObjectURL(selected) : null);
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
          <label htmlFor="landmark-photo" className="block text-sm font-bold text-stone-900">
            {unlocked ? "Replace your photo (optional)" : "Your photo"}
          </label>
          <label
            htmlFor="landmark-photo"
            className="mt-2 flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border-2 border-dashed border-stone-300 bg-stone-50 px-4 py-4 text-sm font-semibold text-stone-700 hover:border-red-700 focus-within:outline-2 focus-within:outline-red-700"
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
          {preview && (
            // A local object URL preview; next/image doesn't apply to blob: URLs.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Preview of the photo you chose" className="mt-3 max-h-72 w-full rounded-xl object-contain bg-stone-100" />
          )}
        </div>

        <div>
          <label htmlFor="landmark-caption" className="block text-sm font-bold text-stone-900">Caption (optional)</label>
          <input
            id="landmark-caption"
            name="caption"
            defaultValue={currentCaption}
            maxLength={CAPTION_MAX}
            placeholder="Say something about your visit"
            className="mt-2 block w-full min-w-0 rounded-xl border border-stone-300 bg-white px-3 py-2.5 text-base text-stone-950 focus-visible:outline-2 focus-visible:outline-red-700"
          />
        </div>

        <p className="flex gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
          <Info aria-hidden="true" size={18} className="mt-0.5 shrink-0" />
          <span>
            Your photo is visible to everyone who has unlocked this landmark. <strong>Unlocks are permanent:</strong> you
            can change your photo or caption later, but you can&apos;t remove the unlock.
          </span>
        </p>

        {error && <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        {state.success && !error && <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{state.success}</p>}

        <button type="submit" className="w-full rounded-xl bg-red-800 px-5 py-3 font-semibold text-white hover:bg-red-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-700 sm:w-auto">
          {preparing ? "Preparing photo…" : pending ? "Saving…" : unlocked ? "Save changes" : "Unlock landmark"}
        </button>
      </fieldset>
    </form>
  );
}
