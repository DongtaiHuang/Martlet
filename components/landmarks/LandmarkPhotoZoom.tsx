"use client";

import { useId, useRef, useState, type PointerEvent } from "react";
import { Maximize2, RotateCcw, X, ZoomIn, ZoomOut } from "lucide-react";

const MIN_ZOOM = 1;
const MAX_ZOOM = 4;
const ZOOM_STEP = 0.5;

type Point = { x: number; y: number };

type PhotoZoomProps = {
  src: string;
  alt: string;
  photographer: string;
  landmarkName: string;
};

/** Enlarge an already-authorized landmark photo without changing its signed URL or upload flow. */
export function LandmarkPhotoZoom({ src, alt, photographer, landmarkName }: PhotoZoomProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const titleId = useId();
  const hintId = useId();
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [pinching, setPinching] = useState(false);

  function clampOffset(point: Point, scale: number): Point {
    const image = imageRef.current;
    const viewport = viewportRef.current;
    if (!image || !viewport) return point;
    const maxX = Math.max(0, (image.clientWidth * scale - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (image.clientHeight * scale - viewport.clientHeight) / 2);
    return {
      x: Math.max(-maxX, Math.min(maxX, point.x)),
      y: Math.max(-maxY, Math.min(maxY, point.y)),
    };
  }

  function changeZoom(next: number) {
    const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    setZoom(scale);
    setOffset((point) => scale === MIN_ZOOM ? { x: 0, y: 0 } : clampOffset(point, scale));
  }

  function resetView() {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setPinching(false);
    activePointers.current.clear();
    pinchStart.current = null;
  }

  function openViewer() {
    resetView();
    dialogRef.current?.showModal();
  }

  function closeViewer() {
    dialogRef.current?.close();
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
    event.currentTarget.setPointerCapture(event.pointerId);
    if (activePointers.current.size === 2) {
      const [a, b] = Array.from(activePointers.current.values());
      pinchStart.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), zoom };
      setPinching(true);
      setDragging(false);
    } else if (zoom > MIN_ZOOM) {
      setDragging(true);
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const previous = activePointers.current.get(event.pointerId);
    if (!previous) return;
    activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });

    if (activePointers.current.size === 2 && pinchStart.current) {
      const [a, b] = Array.from(activePointers.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      const initial = pinchStart.current;
      if (initial.distance > 0) changeZoom(initial.zoom * distance / initial.distance);
    } else if (zoom > MIN_ZOOM && activePointers.current.size === 1) {
      setOffset((point) => clampOffset({
        x: point.x + event.clientX - previous.x,
        y: point.y + event.clientY - previous.y,
      }, zoom));
    }
  }

  function onPointerEnd(event: PointerEvent<HTMLDivElement>) {
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) {
      pinchStart.current = null;
      setPinching(false);
    }
    if (activePointers.current.size === 0) setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openViewer}
        aria-label={`Enlarge photo by ${photographer} at ${landmarkName}`}
        className="group relative block w-full overflow-hidden bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        {/* Short-lived Supabase Storage signed URLs are deliberately rendered without image optimization. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          className="aspect-[4/3] w-full object-cover transition-transform duration-200 group-hover:scale-[1.02]"
        />
        <span aria-hidden="true" className="absolute right-3 bottom-3 inline-flex items-center gap-1 rounded-lg bg-stone-950/80 px-2.5 py-1.5 text-xs font-semibold text-white">
          <Maximize2 size={15} /> Enlarge
        </span>
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        aria-describedby={hintId}
        onClose={() => { resetView(); triggerRef.current?.focus(); }}
        onKeyDown={(event) => {
          if (event.key === "+" || event.key === "=") {
            event.preventDefault();
            changeZoom(zoom + ZOOM_STEP);
          } else if (event.key === "-" || event.key === "_") {
            event.preventDefault();
            changeZoom(zoom - ZOOM_STEP);
          } else if (event.key === "0") {
            event.preventDefault();
            resetView();
          }
        }}
        className="fixed inset-0 m-0 h-[100dvh] max-h-none w-screen max-w-none border-0 bg-stone-950 p-0 text-white backdrop:bg-black/85"
      >
        <div className="flex h-full min-h-0 flex-col">
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-white/20 px-4 py-3">
            <div className="min-w-0">
              <h2 id={titleId} className="truncate text-sm font-bold sm:text-base">
                {photographer} · {landmarkName}
              </h2>
              <p id={hintId} className="text-xs text-stone-300">
                Zoom with buttons or pinch. Drag to move. Press Escape to close.
              </p>
            </div>
            <div className="flex items-center gap-1" role="group" aria-label="Photo zoom controls">
              <button
                type="button"
                aria-label="Zoom out"
                title="Zoom out (-)"
                disabled={zoom <= MIN_ZOOM}
                onClick={() => changeZoom(zoom - ZOOM_STEP)}
                className="inline-grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
              >
                <ZoomOut aria-hidden="true" size={20} />
              </button>
              <output aria-live="polite" aria-label="Zoom level" className="w-12 text-center text-sm tabular-nums">
                {Math.round(zoom * 100)}%
              </output>
              <button
                type="button"
                aria-label="Zoom in"
                title="Zoom in (+)"
                disabled={zoom >= MAX_ZOOM}
                onClick={() => changeZoom(zoom + ZOOM_STEP)}
                className="inline-grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
              >
                <ZoomIn aria-hidden="true" size={20} />
              </button>
              <button
                type="button"
                aria-label="Reset zoom"
                title="Reset zoom (0)"
                disabled={zoom === MIN_ZOOM && offset.x === 0 && offset.y === 0}
                onClick={resetView}
                className="inline-grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-40"
              >
                <RotateCcw aria-hidden="true" size={18} />
              </button>
              <button
                type="button"
                aria-label="Close photo viewer"
                title="Close (Escape)"
                onClick={closeViewer}
                className="ml-1 inline-grid min-h-11 min-w-11 place-items-center rounded-lg hover:bg-white/15 focus-visible:outline-2 focus-visible:outline-white"
              >
                <X aria-hidden="true" size={22} />
              </button>
            </div>
          </div>

          <div
            ref={viewportRef}
            aria-label="Enlarged landmark photo"
            className="flex min-h-0 flex-1 items-center justify-center overflow-hidden p-3 sm:p-6"
            style={{ touchAction: "none", cursor: zoom > MIN_ZOOM ? (dragging ? "grabbing" : "grab") : "zoom-in" }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
            onDoubleClick={() => changeZoom(zoom > MIN_ZOOM ? MIN_ZOOM : 2)}
          >
            {/* Same signed URL as the thumbnail; no new Storage permissions or downloads. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imageRef}
              src={src}
              alt={alt}
              draggable={false}
              className="pointer-events-none max-h-full max-w-full select-none object-contain"
              style={{
                transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
                transition: dragging || pinching ? "none" : "transform 120ms ease-out",
              }}
            />
          </div>
        </div>
      </dialog>
    </>
  );
}
