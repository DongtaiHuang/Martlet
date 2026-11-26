"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Download, ImagePlus, Trash2 } from "lucide-react";
import { removePhotoAction, uploadPhotoAction } from "@/app/meetups/[id]/photo-actions";
import { ReportButton } from "@/components/board/BoardControls";
import { prepareLandmarkPhoto } from "@/lib/landmark-photo";
import { PHOTOS_PER_PERSON } from "@/lib/meetup-album";
import type { AlbumPhoto } from "@/lib/meetup-photos";
import { makeZip } from "@/lib/zip";

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
const button = `inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-ink hover:border-brand disabled:opacity-60 ${focus}`;

const slug = (text: string) => text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "meetup";

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function MeetupAlbum({ meetupId, meetupTitle, photos, myCount }: { meetupId: string; meetupTitle: string; photos: AlbumPhoto[]; myCount: number }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [removing, startRemove] = useTransition();
  const left = Math.max(0, PHOTOS_PER_PERSON - myCount);

  async function upload(files: File[]) {
    const batch = files.slice(0, left);
    const problems: string[] = files.length > left ? [`You can add ${left} more ${left === 1 ? "photo" : "photos"}, so ${files.length - left} were skipped.`] : [];
    setBusy(true);
    setErrors([]);
    for (const [i, file] of batch.entries()) {
      setStatus(`Uploading ${i + 1} of ${batch.length}…`);
      try {
        const form = new FormData();
        form.set("photo", await prepareLandmarkPhoto(file), "photo.jpg");
        const error = await uploadPhotoAction(meetupId, form);
        if (error) problems.push(`${file.name}: ${error}`);
      } catch (error) {
        problems.push(`${file.name}: ${error instanceof Error ? error.message : "couldn't be used."}`);
      }
    }
    setBusy(false);
    setStatus(batch.length > problems.length ? "Photos added." : null);
    setErrors(problems);
    if (input.current) input.current.value = "";
    router.refresh();
  }

  async function downloadAll() {
    setBusy(true);
    setErrors([]);
    try {
      const entries = [];
      for (const [i, photo] of photos.entries()) {
        setStatus(`Preparing ${i + 1} of ${photos.length}…`);
        const response = await fetch(photo.url);
        if (!response.ok) throw new Error("A photo couldn't be downloaded. Refresh and try again.");
        entries.push({ name: `${slug(meetupTitle)}-${String(i + 1).padStart(3, "0")}.jpg`, data: new Uint8Array(await response.arrayBuffer()) });
      }
      saveBlob(new Blob([makeZip(entries) as BlobPart], { type: "application/zip" }), `${slug(meetupTitle)}-photos.zip`);
      setStatus("Download started.");
    } catch (error) {
      setStatus(null);
      setErrors([error instanceof Error ? error.message : "The download failed."]);
    }
    setBusy(false);
  }

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`${button} cursor-pointer has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-focus ${busy || left === 0 ? "pointer-events-none opacity-60" : ""}`}>
          <ImagePlus aria-hidden="true" size={17} /> Add photos
          <input ref={input} type="file" accept="image/*" multiple disabled={busy || left === 0} className="sr-only"
            onChange={(e) => { const files = [...(e.target.files ?? [])]; if (files.length) void upload(files); }} />
        </label>
        {photos.length > 0 && (
          <button type="button" onClick={() => void downloadAll()} disabled={busy} className={button}>
            <Download aria-hidden="true" size={17} /> Download all ({photos.length})
          </button>
        )}
      </div>
      <p className="mt-2 text-xs text-ink-muted">
        {left === 0 ? `You’ve shared the maximum of ${PHOTOS_PER_PERSON} photos.` : `You can add ${left} more. Photos are resized on your device and location data is removed.`}
      </p>
      <div aria-live="polite" className="mt-2 text-sm">
        {status && <p className="font-semibold text-ink-2">{status}</p>}
        {errors.length > 0 && <ul role="alert" className="mt-1 list-disc pl-5 text-brand-ink">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>}
      </div>

      {photos.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-line-strong p-6 text-center text-sm text-ink-muted">No photos yet. Be the first to share one!</p>
      ) : (
        <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {photos.map((photo) => (
            <li key={photo.id} className="overflow-hidden rounded-xl border border-line bg-canvas">
              <a href={photo.url} target="_blank" rel="noreferrer" className={`block ${focus}`}>
                {/* eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL from a private bucket */}
                <img src={photo.url} alt={`Photo shared by ${photo.mine ? "you" : photo.uploaderName}`} loading="lazy" className="aspect-square w-full object-cover" />
                <span className="sr-only"> (opens full size in a new tab)</span>
              </a>
              <div className="flex flex-wrap items-center gap-1 px-2 py-1">
                <span className="mr-auto truncate text-xs text-ink-muted">{photo.mine ? "You" : photo.uploaderName}</span>
                <a href={photo.downloadUrl} download aria-label="Download photo" className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted hover:text-brand-ink ${focus}`}>
                  <Download aria-hidden="true" size={16} />
                </a>
                {photo.canRemove && (
                  <button type="button" disabled={removing} aria-label="Remove photo"
                    onClick={() => { if (confirm("Remove this photo for everyone?")) startRemove(() => removePhotoAction(meetupId, photo.id)); }}
                    className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-ink-muted hover:text-brand-ink disabled:opacity-60 ${focus}`}>
                    <Trash2 aria-hidden="true" size={16} />
                  </button>
                )}
                {!photo.mine && <ReportButton type="photo" id={photo.id} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
