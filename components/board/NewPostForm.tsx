"use client";

import { useActionState, useState } from "react";
import { ImagePlus } from "lucide-react";
import { createPostAction, type FormState } from "@/app/board/actions";
import Link from "next/link";
import { KIND_INFO, POSTABLE_KINDS, type PostableKind } from "@/lib/board-catalog";
import { FilePreview } from "@/components/forms/FilePreview";
import { prepareLandmarkPhoto } from "@/lib/landmark-photo";

const input = "mt-1 w-full rounded-xl border border-line-strong bg-surface px-3 py-2.5 text-ink focus-visible:outline-2 focus-visible:outline-focus";

export function NewPostForm({ initialKind }: { initialKind: PostableKind }) {
  const [kind, setKind] = useState<PostableKind>(initialKind);
  const [state, action, pending] = useActionState<FormState, FormData>(createPostAction, {});
  const [imageError, setImageError] = useState<string | null>(null);
  const [preview, setPreview] = useState<File | null>(null);

  // Resize + re-encode the image in the browser (drops EXIF/GPS, ADR 0009) before submitting.
  const submit = async (form: FormData) => {
    const file = form.get("image");
    if (file instanceof File && file.size > 0) {
      try { form.set("image", await prepareLandmarkPhoto(file), "image.jpg"); }
      catch (e) { setImageError(e instanceof Error ? e.message : "Couldn't use that image."); return; }
    } else form.delete("image");
    return action(form);
  };

  return (
    <form action={submit} className="mt-6 grid gap-5 rounded-2xl border border-line bg-surface p-5 shadow-sm">
      <fieldset>
        <legend className="text-sm font-semibold">What are you posting?</legend>
        <div className="mt-2 grid grid-cols-3 gap-2">
          {POSTABLE_KINDS.map((k) => (
            <label key={k} className={`flex min-h-14 cursor-pointer flex-col items-center justify-center rounded-xl border p-2 text-sm font-semibold has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${kind === k ? "border-brand bg-brand-soft text-brand-ink-strong" : "border-line-strong text-ink-2 hover:border-brand"}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />
              <span aria-hidden="true" className="text-xl">{KIND_INFO[k].emoji}</span>{KIND_INFO[k].label}
            </label>
          ))}
        </div>
        <p className="mt-2 text-sm text-ink-muted">{KIND_INFO[kind].hint}</p>
        <p className="mt-1 text-sm text-ink-muted">Offering music, coding, photography, art or tutoring? Share it on <Link href="/creators/edit" className="font-semibold text-brand-ink underline">your creator profile</Link>.</p>
      </fieldset>

      <label className="text-sm font-semibold">Title
        <input name="title" required minLength={3} maxLength={120} defaultValue={state.fields?.title} className={input}
          placeholder={kind === "question" ? "e.g. Best quiet place to study near Trottier?" : ""} />
      </label>
      <label className="text-sm font-semibold">{kind === "meme" ? "Caption" : "Details"} <span className="font-normal text-ink-muted">(optional)</span>
        <textarea name="body" maxLength={2000} rows={5} defaultValue={state.fields?.body} className={input} />
      </label>
      {kind === "meme" && (
        <label className="text-sm font-semibold">
          <span className="flex items-center gap-2"><ImagePlus aria-hidden="true" size={16} /> Image <span className="font-normal text-ink-muted">(resized on your device; location data removed)</span></span>
          <input name="image" type="file" accept="image/*" className={`${input} file:mr-3 file:rounded-lg file:border-0 file:bg-brand-soft file:px-3 file:py-1.5 file:font-semibold file:text-brand-ink`}
            onChange={(e) => { setImageError(null); setPreview(e.target.files?.[0] ?? null); }} />
          {preview && <FilePreview file={preview} label="Preview of your image" className="mt-2 max-h-64 rounded-xl" />}
        </label>
      )}
      <label className="text-sm font-semibold">Link <span className="font-normal text-ink-muted">(optional, https)</span>
        <input name="link" type="url" pattern="https://.*" maxLength={300} defaultValue={state.fields?.link} className={input} />
      </label>
      <label className="text-sm font-semibold">Tags <span className="font-normal text-ink-muted">(up to 5, comma separated: comp 202, food, redpath)</span>
        <input name="tags" maxLength={120} defaultValue={state.fields?.tags} className={input} />
      </label>

      {(state.error || imageError) && <p role="alert" className="text-sm font-semibold text-brand-ink">{imageError ?? state.error}</p>}
      <p className="text-xs text-ink-muted">Be kind. Posts that get reported by several students are hidden until a moderator reviews them.</p>
      <button type="submit" disabled={pending} className="inline-flex min-h-12 w-fit items-center rounded-xl bg-brand px-6 font-bold text-on-brand hover:bg-brand-hover disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
        {pending ? "Posting…" : "Post"}
      </button>
    </form>
  );
}
