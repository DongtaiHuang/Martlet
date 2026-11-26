"use client";

import { useActionState, useRef, useState, useTransition } from "react";
import { Camera, Trash2 } from "lucide-react";
import { removePhotoAction, uploadPhotoAction, type FormState } from "@/app/creators/actions";
import { prepareSquarePhoto } from "@/lib/square-photo";
import { CreatorAvatar } from "./CreatorAvatar";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const btn = `inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 text-sm font-bold disabled:opacity-60 ${focus}`;

/** Choose, replace or remove the creator's profile photo (ADR 0045). */
export function PhotoPicker({ userId, name, photoUrl }: { userId: string; name: string; photoUrl: string | null }) {
  const [state, action, pending] = useActionState<FormState, FormData>(uploadPhotoAction, {});
  const [localError, setLocalError] = useState<string | null>(null);
  const [removing, startRemove] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const [, startUpload] = useTransition();

  // Crop to a square and re-encode in the browser (drops EXIF/GPS), then upload right away.
  async function choose(file: File | undefined) {
    if (!file) return;
    setLocalError(null);
    try {
      const data = new FormData();
      data.set("photo", await prepareSquarePhoto(file), "photo.jpg");
      startUpload(() => action(data));
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : "Couldn’t use that photo.");
    } finally {
      if (input.current) input.current.value = "";
    }
  }

  const error = localError ?? state.error;
  return (
    <div className="flex flex-wrap items-center gap-4">
      <CreatorAvatar userId={userId} photoUrl={photoUrl} name={name} className="size-20" />
      <div className="grid gap-2">
        <div className="flex flex-wrap gap-2">
          <label className={`${btn} cursor-pointer border border-line-strong text-ink hover:border-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${pending ? "pointer-events-none opacity-60" : ""}`}>
            <Camera aria-hidden="true" size={16} /> {pending ? "Uploading…" : photoUrl ? "Change photo" : "Add a photo"}
            <input ref={input} type="file" accept="image/*" className="sr-only" disabled={pending} onChange={(e) => void choose(e.target.files?.[0])} />
          </label>
          {photoUrl && (
            <button type="button" disabled={removing || pending} className={`${btn} text-brand-ink hover:underline`}
              onClick={() => startRemove(async () => setLocalError(await removePhotoAction()))}>
              <Trash2 aria-hidden="true" size={16} /> Remove
            </button>
          )}
        </div>
        <p className="text-xs text-ink-muted">Optional. Cropped to a square on your device; location data removed. Only signed-in students see it.</p>
        {error && <p role="alert" className="text-sm font-semibold text-brand-ink">{error}</p>}
        {state.success && !error && <p role="status" className="text-sm font-semibold text-ok-ink">{state.success}</p>}
      </div>
    </div>
  );
}
