"use client";

// Landmark photo wall: bento grid with a hero tile, 3D tilt + glare on hover, staggered entrance,
// and an immersive viewer that the tapped photo "flies" into (View Transitions where supported).
import { useCallback, useState, type PointerEvent } from "react";
import { flushSync } from "react-dom";
import { Expand, ImageOff, RefreshCw, Smartphone, Sparkles } from "lucide-react";
import type { LandmarkPhoto } from "@/types/landmark";
import { LandmarkPhotoViewer, VIEWER_TRANSITION_NAME } from "./LandmarkPhotoViewer";
import { useShakeReveal } from "./useShakeReveal";

const EDIT_THRESHOLD_MS = 60_000;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function tilt(event: PointerEvent<HTMLElement>) {
  if (event.pointerType !== "mouse" || reducedMotion()) return;
  const el = event.currentTarget, r = el.getBoundingClientRect();
  const x = (event.clientX - r.left) / r.width, y = (event.clientY - r.top) / r.height;
  el.style.setProperty("--rx", `${(0.5 - y) * 10}deg`);
  el.style.setProperty("--ry", `${(x - 0.5) * 12}deg`);
  el.style.setProperty("--gx", `${x * 100}%`);
  el.style.setProperty("--gy", `${y * 100}%`);
}
function untilt(event: PointerEvent<HTMLElement>) {
  const el = event.currentTarget;
  for (const p of ["--rx", "--ry"]) el.style.setProperty(p, "0deg");
}

/** Photos from everyone who unlocked a landmark. Only rendered once the viewer has unlocked it. */
export function LandmarkGallery({ photos, landmarkName, landmarkId }: { photos: LandmarkPhoto[]; landmarkName: string; landmarkId: string }) {
  const othersCount = photos.filter((p) => !p.is_mine && p.photo_url).length;
  const shake = useShakeReveal(landmarkId, othersCount > 0);
  const hidden = othersCount > 0 && !shake.revealed;
  const [open, setOpen] = useState<number | null>(null);
  const [morph, setMorph] = useState<number | null>(null);
  const onIndex = useCallback((i: number) => { setMorph(null); setOpen(i); }, []);
  const onClose = useCallback(() => setOpen(null), []);

  function openAt(i: number, img: HTMLImageElement | null) {
    const doc = document as Document & { startViewTransition?: (cb: () => void) => { finished: Promise<void> } };
    if (!doc.startViewTransition || !img || reducedMotion()) { setOpen(i); return; }
    // The tile's image and the viewer's image share a name, so the browser morphs one into the other.
    img.style.viewTransitionName = VIEWER_TRANSITION_NAME;
    const t = doc.startViewTransition(() => {
      img.style.viewTransitionName = "";
      flushSync(() => { setMorph(i); setOpen(i); });
    });
    t.finished.finally(() => setMorph(null));
  }

  if (photos.length === 0) {
    return <p className="text-sm text-ink-muted">No photos yet. Unlock it and be the first.</p>;
  }

  return (
    <>
      <p className="mb-3 text-sm text-ink-muted">{photos.length} {photos.length === 1 ? "photo" : "photos"} · tap one to step through them full screen</p>
      <div className="relative" onPointerMove={shake.onPointerMove}>
      <ul className={`grid grid-flow-dense grid-cols-2 gap-3 sm:grid-cols-3 ${shake.revealing ? "motion-safe:animate-[martlet-shake_520ms_ease-in-out]" : ""}`}>
        {photos.map((photo, i) => {
          const edited = Date.parse(photo.updated_at) - Date.parse(photo.created_at) > EDIT_THRESHOLD_MS;
          const hero = i === 0 && photos.length > 2;
          return (
            <li
              key={photo.user_id}
              // The progress tree's fruit links here (/landmarks/<id>#my-photo); highlight it when targeted.
              id={photo.is_mine ? "my-photo" : undefined}
              onPointerMove={tilt}
              onPointerLeave={untilt}
              style={{ animationDelay: `${Math.min(i, 12) * 60}ms` }}
              className={`group relative scroll-mt-24 [perspective:900px] motion-safe:animate-[martlet-tile-in_520ms_cubic-bezier(.2,.8,.2,1)_both] target:[&>div]:ring-4 target:[&>div]:ring-brand ${hero ? "col-span-2 row-span-2" : ""}`}
            >
              <div
                aria-hidden={hidden && !photo.is_mine ? true : undefined}
                style={{ transitionDelay: shake.revealing ? `${150 + i * 90}ms` : undefined }}
                className={`relative aspect-square overflow-hidden rounded-2xl bg-surface-muted shadow-sm ring-1 ring-line [transition:transform_300ms_ease-out,box-shadow_300ms_ease-out,filter_700ms_ease-out] ${hidden && !photo.is_mine ? "pointer-events-none [filter:blur(18px)_saturate(1.3)]" : "[filter:none]"} [transform:rotateX(var(--rx,0deg))_rotateY(var(--ry,0deg))] [transform-style:preserve-3d] group-hover:shadow-2xl group-hover:shadow-black/25`}>
                {photo.photo_url ? (
                  <button
                    type="button"
                    onClick={(e) => openAt(i, e.currentTarget.querySelector("img"))}
                    aria-label={`Open photo by ${photo.display_name}${photo.caption ? `: ${photo.caption}` : ""}`}
                    className="absolute inset-0 block focus-visible:outline-3 focus-visible:outline-offset-2 focus-visible:outline-focus"
                  >
                    {/* Short-lived Supabase Storage signed URLs are deliberately rendered without image optimization. */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.photo_url} alt={`${photo.display_name} at ${landmarkName}`} loading={i < 4 ? "eager" : "lazy"}
                      className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.06]" />
                    {/* Glare that follows the pointer */}
                    <span aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100 bg-[radial-gradient(circle_at_var(--gx,50%)_var(--gy,50%),rgb(255_255_255/0.28),transparent_55%)]" />
                    <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent px-3 pt-10 pb-3 text-left">
                      <span className={`block font-bold text-white drop-shadow ${hero ? "text-lg" : "text-sm"}`}>{photo.display_name}</span>
                      {photo.caption && <span className={`mt-0.5 block text-white/85 ${hero ? "line-clamp-2 text-sm" : "line-clamp-1 text-xs"}`}>{photo.caption}</span>}
                      <span className="mt-0.5 block text-[11px] text-white/60">
                        {new Date(photo.created_at).toLocaleDateString("en-CA", { month: "short", day: "numeric", timeZone: "America/Toronto" })}{edited && " · edited"}
                      </span>
                    </span>
                    <span aria-hidden="true" className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/40 text-white opacity-0 backdrop-blur transition-opacity duration-300 group-hover:opacity-100"><Expand size={15} /></span>
                  </button>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-sm text-ink-subtle">
                    <ImageOff aria-hidden="true" size={24} />
                    Photo unavailable
                  </div>
                )}
                {photo.is_mine && (
                  <div className="absolute top-2 left-2 flex items-center gap-1.5">
                    <span className="rounded-full bg-brand px-2 py-0.5 text-xs font-bold text-on-brand shadow">You</span>
                    {/* Only the owner can replace their photo */}
                    <a href="#edit-my-photo" className="inline-flex min-h-8 items-center gap-1 rounded-full bg-black/45 px-2.5 text-xs font-semibold text-white backdrop-blur hover:bg-black/65 focus-visible:outline-2 focus-visible:outline-white">
                      <RefreshCw aria-hidden="true" size={12} /> Replace
                    </a>
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {hidden && (
        <div className="absolute inset-0 z-10 grid place-items-center p-4">
          <div className="max-w-xs rounded-2xl bg-surface/90 p-5 text-center shadow-xl ring-1 ring-line backdrop-blur-md motion-safe:animate-[martlet-fade-in_400ms_ease-out]">
            <Smartphone aria-hidden="true" size={30} className="mx-auto text-brand-ink motion-safe:animate-[martlet-wiggle_1.4s_ease-in-out_infinite]" />
            <p className="mt-2 font-bold text-ink">{othersCount} {othersCount === 1 ? "photo" : "photos"} unlocked!</p>
            <p className="mt-1 text-sm text-ink-muted">Shake your phone, or wiggle your mouse over the photos, to reveal what other students shared here.</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {shake.needsMotionPermission && (
                <button type="button" onClick={() => void shake.enableMotion()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-ink focus-visible:outline-2 focus-visible:outline-focus">
                  <Smartphone aria-hidden="true" size={16} /> Enable shake
                </button>
              )}
              <button type="button" onClick={shake.reveal} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                <Sparkles aria-hidden="true" size={16} /> Reveal
              </button>
            </div>
          </div>
        </div>
      )}
      {shake.revealing && (
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 overflow-visible motion-reduce:hidden">
          {Array.from({ length: 18 }, (_, k) => (
            <span key={k} className="absolute top-1/2 left-1/2 size-2 rounded-full"
              style={{ background: ["#f2c14e", "var(--m-brand)", "#ffffff", "#8fdc9c"][k % 4], ["--a" as string]: `${(k / 18) * 360}deg`, ["--d" as string]: `${90 + (k % 3) * 45}px`, animation: `martlet-sparkle 900ms cubic-bezier(.2,.8,.2,1) ${k * 12}ms both` }} />
          ))}
        </div>
      )}
      <p role="status" className="sr-only">{shake.revealing ? `${othersCount} photos revealed.` : ""}</p>
      </div>
      <LandmarkPhotoViewer photos={photos} index={open} onIndex={onIndex} onClose={onClose} landmarkName={landmarkName} morphIndex={morph} />
    </>
  );
}
