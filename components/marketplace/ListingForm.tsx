"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { createListingAction, type FormState } from "@/app/marketplace/actions";
import { prepareLandmarkPhoto } from "@/lib/landmark-photo";
import { CAMPUS_LOCATIONS } from "@/lib/locations";
import {
  CATEGORY_INFO, CONDITIONS, CONDITION_LABELS, KIND_INFO, LISTING_CATEGORIES, LISTING_KINDS, MAX_LISTING_PHOTOS, PROHIBITED_ITEMS,
  type ListingCategory, type ListingKind,
} from "@/lib/marketplace-catalog";

const input = "mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-ink focus-visible:outline-2 focus-visible:outline-focus";
const LOCATIONS = [...CAMPUS_LOCATIONS].sort((a, b) => a.name.localeCompare(b.name));

let nextPhotoKey = 0;

/** Local preview drawn on a canvas, so no URL built from the chosen file reaches the page. */
function PhotoThumb({ file, label }: { file: File; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    createImageBitmap(file, { imageOrientation: "from-image" }).then((bitmap) => {
      const c = canvas.current;
      const ctx = c?.getContext("2d");
      if (cancelled || !c || !ctx) return bitmap.close();
      const side = Math.min(bitmap.width, bitmap.height);
      ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, c.width, c.height);
      bitmap.close();
    }).catch(() => undefined);
    return () => { cancelled = true; };
  }, [file]);
  return <canvas ref={canvas} width={192} height={192} role="img" aria-label={label} className="size-24 rounded-xl bg-surface-muted" />;
}

export function ListingForm() {
  const [state, action, pending] = useActionState<FormState, FormData>(createListingAction, {});
  const [kind, setKind] = useState<ListingKind>((state.fields?.kind as ListingKind) || "sell");
  const [category, setCategory] = useState<ListingCategory>((state.fields?.category as ListingCategory) || "textbooks");
  const [photos, setPhotos] = useState<{ file: File; key: number }[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const priced = kind === "sell" || kind === "wanted";

  function addPhotos(files: File[]) {
    setPhotoError(files.length + photos.length > MAX_LISTING_PHOTOS ? `Up to ${MAX_LISTING_PHOTOS} photos.` : null);
    const room = MAX_LISTING_PHOTOS - photos.length;
    setPhotos([...photos, ...files.slice(0, room).map((file) => ({ file, key: nextPhotoKey++ }))]);
  }

  // Resize + re-encode each photo in the browser (drops EXIF/GPS, ADR 0009) before submitting.
  const submit = async (form: FormData) => {
    form.delete("photos");
    try {
      for (const photo of photos) form.append("photos", await prepareLandmarkPhoto(photo.file), "photo.jpg");
    } catch (error) {
      setPhotoError(error instanceof Error ? error.message : "Couldn’t use one of the photos.");
      return;
    }
    return action(form);
  };

  return (
    <form action={submit} className="mt-6 grid gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <fieldset>
        <legend className="text-sm font-semibold">What are you doing?</legend>
        <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {LISTING_KINDS.map((k) => (
            <label key={k} className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border p-2 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${kind === k ? "border-brand bg-brand-soft text-brand-ink-strong" : "border-line-strong text-ink-2 hover:border-brand"}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />{KIND_INFO[k].verb}
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-muted">{KIND_INFO[kind].hint}</p>
      </fieldset>

      <label className="text-sm font-semibold">Title
        <input name="title" required minLength={3} maxLength={80} defaultValue={state.fields?.title} className={input} placeholder={kind === "wanted" ? "e.g. Graphing calculator for MATH 133" : "e.g. COMP 250 textbook"} />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="text-sm font-semibold">Category
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value as ListingCategory)} className={input}>
            {LISTING_CATEGORIES.map((c) => <option key={c} value={c}>{CATEGORY_INFO[c].label}</option>)}
          </select>
        </label>
        {priced && (
          <label className="text-sm font-semibold">{kind === "sell" ? "Price (CAD)" : "Budget (CAD, optional)"}
            <input name="price" inputMode="decimal" required={kind === "sell"} pattern="\$?\d{1,4}(\.\d{1,2})?" maxLength={8} defaultValue={state.fields?.price} className={input} placeholder="25" />
          </label>
        )}
        {kind !== "wanted" && (
          <label className="text-sm font-semibold">Condition <span className="font-normal text-ink-muted">(optional)</span>
            <select name="condition" defaultValue={state.fields?.condition ?? ""} className={input}>
              <option value="">Not specified</option>
              {CONDITIONS.map((c) => <option key={c} value={c}>{CONDITION_LABELS[c]}</option>)}
            </select>
          </label>
        )}
        {category === "textbooks" && (
          <label className="text-sm font-semibold">Course <span className="font-normal text-ink-muted">(optional)</span>
            <input name="course" maxLength={10} defaultValue={state.fields?.course} className={`${input} uppercase`} placeholder="COMP 250" />
          </label>
        )}
        <label className="text-sm font-semibold">Where to meet
          <select name="meet" required defaultValue={state.fields?.meet ?? ""} className={input}>
            <option value="" disabled>Choose a campus building</option>
            {LOCATIONS.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
        </label>
      </div>

      <label className="text-sm font-semibold">Description <span className="font-normal text-ink-muted">(optional)</span>
        <textarea name="description" maxLength={1000} rows={4} defaultValue={state.fields?.description} className={input}
          placeholder={kind === "swap" ? "What would you like in exchange?" : "Size, edition, any wear, when you’re free…"} />
      </label>

      {kind !== "wanted" && (
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold"><ImagePlus aria-hidden="true" size={16} /> Photos <span className="font-normal text-ink-muted">(up to {MAX_LISTING_PHOTOS}; resized on your device, location data removed)</span></p>
          <div className="mt-2 flex flex-wrap gap-2">
            {photos.map((photo, i) => (
              <div key={photo.key} className="relative">
                <PhotoThumb file={photo.file} label={`Photo ${i + 1}`} />
                <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => setPhotos(photos.filter((p) => p !== photo))}
                  className="absolute -top-2 -right-2 grid size-8 place-items-center rounded-full border border-line-strong bg-surface text-ink shadow focus-visible:outline-2 focus-visible:outline-focus">
                  <X aria-hidden="true" size={15} />
                </button>
              </div>
            ))}
            {photos.length < MAX_LISTING_PHOTOS && (
              <label className="grid size-24 cursor-pointer place-items-center rounded-xl border-2 border-dashed border-line-strong text-ink-muted hover:border-brand has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus">
                <span className="sr-only">Add photos</span><ImagePlus aria-hidden="true" size={22} />
                <input type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addPhotos([...(e.target.files ?? [])]); e.target.value = ""; }} />
              </label>
            )}
          </div>
        </div>
      )}

      <details className="rounded-xl border border-line bg-canvas p-3 text-sm">
        <summary className="cursor-pointer font-semibold">Not allowed on the marketplace</summary>
        <ul className="mt-2 list-disc pl-5 text-ink-2">{PROHIBITED_ITEMS.map((item) => <li key={item}>{item}</li>)}</ul>
      </details>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" name="rules" required className="mt-1 size-4 accent-[var(--m-brand)]" />
        <span>My item is allowed, and I’ll meet in a public campus building. Martlet doesn’t handle payments.</span>
      </label>

      {(state.error || photoError) && <p role="alert" className="text-sm font-semibold text-brand-ink">{photoError ?? state.error}</p>}
      <p className="text-xs text-ink-muted">Listings last 30 days and can be renewed. Listings reported by several students are hidden until a moderator reviews them.</p>
      <button type="submit" disabled={pending} className="inline-flex min-h-12 w-fit items-center rounded-xl bg-brand px-6 font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {pending ? "Posting…" : "Post listing"}
      </button>
    </form>
  );
}
