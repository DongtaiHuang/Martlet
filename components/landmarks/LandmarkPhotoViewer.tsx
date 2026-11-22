"use client";

// Immersive full-screen landmark photo viewer: colour-matched ambient backdrop, directional
// slides, Ken Burns drift, filmstrip, slideshow, swipe/keys, and zoom + pan (usePhotoZoom).
import { useEffect, useId, useLayoutEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, Pause, Play, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";
import type { LandmarkPhoto } from "@/types/landmark";
import { MAX_ZOOM, MIN_ZOOM, ZOOM_STEP, usePhotoZoom } from "./usePhotoZoom";

const SLIDE_MS = 5000;
export const VIEWER_TRANSITION_NAME = "landmark-photo";

const subscribeMotion = (cb: () => void) => {
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
};
const getReduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

const glass = "bg-white/10 ring-1 ring-white/20 backdrop-blur-md";
const iconBtn = `inline-grid size-11 place-items-center rounded-full ${glass} text-white hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-35`;

export function LandmarkPhotoViewer({ photos, index, onIndex, onClose, landmarkName, morphIndex }: {
  photos: LandmarkPhoto[];
  /** Open photo, or null when closed. */
  index: number | null;
  onIndex: (next: number) => void;
  onClose: () => void;
  landmarkName: string;
  /** Photo opened with a shared-element transition (gets the matching view-transition-name). */
  morphIndex: number | null;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; id: number } | null>(null);
  const [direction, setDirection] = useState<1 | -1>(1);
  const [playing, setPlaying] = useState(false);
  const reduced = useSyncExternalStore(subscribeMotion, getReduced, () => false);
  const {
    imageRef, viewportRef, zoom: zoomLevel, zoomed, changeZoom, resetView, pointerHandlers, handleZoomKey, imageStyle, cursor,
  } = usePhotoZoom();
  const titleId = useId();
  const open = index !== null;
  const count = photos.length;
  const photo = open ? photos[index] : null;

  // Open/close the modal synchronously so a view transition can snapshot it.
  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  function go(step: 1 | -1) {
    if (index === null || count < 2) return;
    setDirection(step);
    resetView();
    onIndex((index + step + count) % count);
  }

  // Slideshow: advance every SLIDE_MS; pauses while zoomed.
  useEffect(() => {
    if (!open || !playing || zoomed || count < 2) return;
    const t = window.setTimeout(() => { setDirection(1); onIndex(((index ?? 0) + 1) % count); }, SLIDE_MS);
    return () => window.clearTimeout(t);
  }, [open, playing, index, count, zoomed, onIndex]);

  // Keep the active thumbnail centred and warm the neighbours' images.
  useEffect(() => {
    if (index === null) return;
    stripRef.current?.querySelector<HTMLElement>(`[data-i="${index}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: reduced ? "auto" : "smooth" });
    for (const i of [index - 1, index + 1]) {
      const url = photos[(i + count) % count]?.photo_url;
      if (url) new Image().src = url;
    }
  }, [index, photos, count, reduced]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    if (!zoomed) swipe.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    pointerHandlers.onPointerDown(e);
  }
  function onPointerUp(e: PointerEvent<HTMLDivElement>) {
    const s = swipe.current;
    swipe.current = null;
    pointerHandlers.onPointerUp(e);
    if (!s || s.id !== e.pointerId || zoomed) return;
    const dx = e.clientX - s.x, dy = e.clientY - s.y;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx < 0 ? 1 : -1);
  }

  const date = photo ? new Date(photo.created_at).toLocaleDateString("en-CA", { month: "long", day: "numeric", year: "numeric" }) : "";

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-roledescription="photo viewer"
      onClose={() => { resetView(); setPlaying(false); onClose(); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") { e.preventDefault(); go(1); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); go(-1); }
        else if (e.key === " " && e.target === e.currentTarget) { e.preventDefault(); setPlaying((p) => !p); }
        else if (handleZoomKey(e)) e.preventDefault();
      }}
      className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none overflow-hidden border-0 bg-black p-0 text-white backdrop:bg-black open:animate-[martlet-viewer-in_220ms_ease-out]"
    >
      {photo && (
        <div className="relative flex h-full min-h-0 flex-col">
          {/* Ambient backdrop: the same photo, blurred and glowing, so the room takes its colour. */}
          {photo.photo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={`bg-${index}`} src={photo.photo_url} alt="" aria-hidden="true"
              className="pointer-events-none absolute inset-0 h-full w-full scale-125 object-cover opacity-55 blur-3xl saturate-150 animate-[martlet-fade-in_600ms_ease-out]" />
          )}
          <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,rgb(0_0_0/0.55)_70%,rgb(0_0_0/0.85)_100%)]" />

          {/* Top bar */}
          <div className="relative z-10 flex shrink-0 items-center justify-between gap-3 px-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-5">
            <p className="rounded-full bg-black/30 px-3 py-1.5 text-sm font-semibold tabular-nums backdrop-blur" aria-live="polite">
              {(index ?? 0) + 1} / {count}
            </p>
            <div className="flex items-center gap-2" role="group" aria-label="Viewer controls">
              <button type="button" className={iconBtn} aria-label="Zoom out" title="Zoom out (-)" disabled={zoomLevel <= MIN_ZOOM} onClick={() => changeZoom(zoomLevel - ZOOM_STEP)}><ZoomOut aria-hidden="true" size={19} /></button>
              <button type="button" className={iconBtn} aria-label="Zoom in" title="Zoom in (+)" disabled={zoomLevel >= MAX_ZOOM} onClick={() => changeZoom(zoomLevel + ZOOM_STEP)}><ZoomIn aria-hidden="true" size={19} /></button>
              {zoomed && <button type="button" className={iconBtn} aria-label="Reset zoom" title="Reset (0)" onClick={resetView}><RotateCcw aria-hidden="true" size={17} /></button>}
              {count > 1 && (
                <button type="button" className={iconBtn} aria-pressed={playing} aria-label={playing ? "Pause slideshow" : "Play slideshow"} title="Slideshow (Space)" onClick={() => setPlaying((p) => !p)}>
                  {playing ? <Pause aria-hidden="true" size={18} /> : <Play aria-hidden="true" size={18} />}
                </button>
              )}
              <button type="button" className={iconBtn} aria-label="Close viewer" title="Close (Escape)" onClick={() => dialogRef.current?.close()}><X aria-hidden="true" size={21} /></button>
            </div>
          </div>
          {playing && count > 1 && (
            <div aria-hidden="true" className="relative z-10 mx-3 mt-2 h-0.5 overflow-hidden rounded bg-white/15 sm:mx-5">
              <div key={`bar-${index}`} className="h-full origin-left bg-white/80" style={{ animation: `martlet-progress ${SLIDE_MS}ms linear` }} />
            </div>
          )}

          {/* Stage */}
          <div
            ref={viewportRef}
            className="relative z-0 flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-3 sm:px-16"
            style={{ touchAction: "none", cursor: cursor }}
            onPointerDown={onPointerDown}
            onPointerMove={pointerHandlers.onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={pointerHandlers.onPointerCancel}
            onDoubleClick={pointerHandlers.onDoubleClick}
          >
            <div
              key={`slide-${index}`}
              className="flex h-full w-full items-center justify-center"
              style={reduced ? undefined : { animation: `${direction === 1 ? "martlet-slide-from-right" : "martlet-slide-from-left"} 380ms cubic-bezier(.2,.8,.2,1)` }}
            >
              {photo.photo_url ? (
                <div className={!reduced && !zoomed && !playing ? "animate-[martlet-kenburns_14s_ease-in-out_infinite_alternate]" : ""} style={{ maxHeight: "100%", maxWidth: "100%", display: "flex" }}>
                  {/* Same short-lived signed URL as the tile; no new Storage permissions. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    ref={imageRef}
                    src={photo.photo_url}
                    alt={`${photo.display_name} at ${landmarkName}`}
                    draggable={false}
                    className="pointer-events-none max-h-[calc(100dvh-13rem)] max-w-full select-none rounded-xl object-contain shadow-[0_30px_80px_-20px_rgb(0_0_0/0.8)]"
                    style={{ ...imageStyle, viewTransitionName: morphIndex === index ? VIEWER_TRANSITION_NAME : undefined }}
                  />
                </div>
              ) : (
                <p className="text-white/70">Photo unavailable</p>
              )}
            </div>

            {count > 1 && (
              <>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={`${iconBtn} absolute left-2 top-1/2 size-12 -translate-y-1/2`}><ChevronLeft aria-hidden="true" size={26} /></button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className={`${iconBtn} absolute right-2 top-1/2 size-12 -translate-y-1/2`}><ChevronRight aria-hidden="true" size={26} /></button>
              </>
            )}
          </div>

          {/* Caption card */}
          <div className="relative z-10 mx-3 sm:mx-5">
            <div key={`cap-${index}`} className={`max-w-xl rounded-2xl px-4 py-3 ${glass} animate-[martlet-fade-in_400ms_ease-out]`}>
              <h2 id={titleId} className="text-base font-bold">
                {photo.display_name}
                {photo.is_mine && <span className="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs font-semibold">You</span>}
              </h2>
              {photo.caption && <p className="mt-0.5 text-sm text-white/85 [overflow-wrap:anywhere]">{photo.caption}</p>}
              <p className="mt-0.5 text-xs text-white/60">{landmarkName} · <time dateTime={photo.created_at}>{date}</time></p>
            </div>
          </div>

          {/* Filmstrip */}
          {count > 1 && (
            <div ref={stripRef} role="group" aria-label="All photos" className="relative z-10 flex shrink-0 snap-x gap-2 overflow-x-auto px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] [scrollbar-width:none] sm:justify-center sm:px-5">
              {photos.map((p, i) => (
                <button
                  key={p.user_id} type="button" data-i={i} aria-label={`Photo ${i + 1} by ${p.display_name}`} aria-current={i === index}
                  onClick={() => { setDirection(i > (index ?? 0) ? 1 : -1); resetView(); onIndex(i); }}
                  className={`relative size-14 shrink-0 snap-center overflow-hidden rounded-lg transition-all duration-300 focus-visible:outline-2 focus-visible:outline-white ${i === index ? "scale-110 opacity-100 ring-2 ring-white" : "opacity-50 hover:opacity-90"}`}
                >
                  {p.photo_url
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.photo_url} alt="" loading="lazy" className="h-full w-full object-cover" />
                    : <span className="block h-full w-full bg-white/10" />}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </dialog>
  );
}
