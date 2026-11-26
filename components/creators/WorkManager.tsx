"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { ImagePlus, Link2, Trash2 } from "lucide-react";
import { addWorkAction, deleteWorkAction, type FormState } from "@/app/creators/actions";
import { FilePreview } from "@/components/forms/FilePreview";
import { MAX_WORKS, linkLabel } from "@/lib/creator-catalog";
import type { CreatorWork } from "@/lib/creators";
import { prepareLandmarkPhoto } from "@/lib/landmark-photo";

const input = "mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 font-normal text-ink focus-visible:outline-2 focus-visible:outline-focus";
const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";

function WorkRow({ work }: { work: CreatorWork }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex items-center gap-3 rounded-xl border border-line bg-canvas p-2">
      {work.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket
        <img src={work.image_url} alt="" className="size-16 shrink-0 rounded-lg object-cover" />
      ) : (
        <div aria-hidden="true" className="grid size-16 shrink-0 place-items-center rounded-lg bg-surface-muted text-ink-muted"><Link2 size={22} /></div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold">{work.title}</p>
        {work.link && <p className="truncate text-xs text-ink-muted">{linkLabel(work.link)}</p>}
        {error && <p role="alert" className="text-xs font-semibold text-brand-ink">{error}</p>}
      </div>
      <button type="button" disabled={pending} aria-label={`Remove “${work.title}”`}
        onClick={() => { if (confirm(`Remove “${work.title}” from your portfolio?`)) start(async () => setError(await deleteWorkAction(work.id))); }}
        className={`grid size-11 shrink-0 place-items-center rounded-xl text-ink-muted hover:text-brand-ink disabled:opacity-60 ${focus}`}>
        <Trash2 aria-hidden="true" size={18} />
      </button>
    </li>
  );
}

/** The owner's portfolio list plus the form to add a work (an image, a link, or both). */
export function WorkManager({ works }: { works: CreatorWork[] }) {
  const [state, action, pending] = useActionState<FormState, FormData>(addWorkAction, {});
  const [image, setImage] = useState<File | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [handled, setHandled] = useState(state);
  const form = useRef<HTMLFormElement>(null);
  const full = works.length >= MAX_WORKS;

  // After a work is added, clear the chosen image (state adjusted during render; the new key
  // resets the file input) and the text fields.
  if (state !== handled) {
    setHandled(state);
    if (state.success) {
      setImage(null);
      setInputKey((k) => k + 1);
    }
  }
  useEffect(() => { if (state.success) form.current?.reset(); }, [state]);

  // Resize + re-encode the image in the browser (drops EXIF/GPS, ADR 0009) before submitting.
  const submit = async (data: FormData) => {
    data.delete("image");
    if (image) {
      try { data.set("image", await prepareLandmarkPhoto(image), "work.jpg"); }
      catch (e) { setImageError(e instanceof Error ? e.message : "Couldn’t use that image."); return; }
    }
    return action(data);
  };

  return (
    <div className="grid gap-4">
      {works.length > 0 ? (
        <ul className="grid gap-2" aria-label="Your portfolio">{works.map((w) => <WorkRow key={w.id} work={w} />)}</ul>
      ) : (
        <p className="text-sm text-ink-muted">No work yet. Add a few pieces so students can see your style.</p>
      )}

      {full ? (
        <p className="text-sm text-ink-muted">Your portfolio is full ({MAX_WORKS} works). Remove one to add another.</p>
      ) : (
        <form ref={form} action={submit} className="grid gap-4 rounded-2xl border border-dashed border-line-strong p-4">
          <p className="text-sm font-bold">Add a work <span className="font-normal text-ink-muted">({works.length} of {MAX_WORKS})</span></p>
          <label className="text-sm font-semibold">Title
            <input name="title" required maxLength={80} defaultValue={state.fields?.title} className={input} placeholder="e.g. Poster for the SSMU winter fair" />
          </label>
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold"><ImagePlus aria-hidden="true" size={16} /> Image <span className="font-normal text-ink-muted">(optional; resized on your device, location data removed)</span></p>
            <input key={inputKey} type="file" accept="image/*" aria-label="Image"
              onChange={(e) => { setImageError(null); setImage(e.target.files?.[0] ?? null); }}
              className={`${input} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-semibold file:text-brand-ink`} />
            {image && <FilePreview file={image} label="Preview of the image" className="mt-2 max-h-48 rounded-xl" />}
          </div>
          <label className="text-sm font-semibold">Link <span className="font-normal text-ink-muted">(optional: a track, repo, video or post)</span>
            <input name="link" type="url" pattern="https://.*" maxLength={300} defaultValue={state.fields?.link} className={input} placeholder="https://" />
          </label>
          <label className="text-sm font-semibold">Caption <span className="font-normal text-ink-muted">(optional)</span>
            <input name="caption" maxLength={300} defaultValue={state.fields?.caption} className={input} />
          </label>
          {(imageError || state.error) && <p role="alert" className="text-sm font-semibold text-brand-ink">{imageError ?? state.error}</p>}
          {state.success && <p role="status" className="text-sm font-semibold text-ok-ink">{state.success}</p>}
          <button type="submit" disabled={pending} className={`inline-flex min-h-11 w-fit items-center rounded-xl bg-brand px-5 text-sm font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 ${focus}`}>
            {pending ? "Adding…" : "Add to portfolio"}
          </button>
        </form>
      )}
    </div>
  );
}
