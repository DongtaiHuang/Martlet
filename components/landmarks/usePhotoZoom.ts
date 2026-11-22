"use client";

// Zoom + pan for a photo viewer: buttons/keys, pinch, drag, double-click.
// Extracted from DongtaiHuang's LandmarkPhotoZoom (#72) so the gallery viewer can reuse it.
import { earn } from "@/components/achievements/earn";
import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;
export const ZOOM_STEP = 0.5;
type Point = { x: number; y: number };

export function usePhotoZoom() {
  const imageRef = useRef<HTMLImageElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const activePointers = useRef(new Map<number, Point>());
  const pinchStart = useRef<{ distance: number; zoom: number } | null>(null);
  const [zoom, setZoom] = useState(MIN_ZOOM);
  const [offset, setOffset] = useState<Point>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [pinching, setPinching] = useState(false);

  function clampOffset(point: Point, scale: number): Point {
    const image = imageRef.current, viewport = viewportRef.current;
    if (!image || !viewport) return point;
    const maxX = Math.max(0, (image.clientWidth * scale - viewport.clientWidth) / 2);
    const maxY = Math.max(0, (image.clientHeight * scale - viewport.clientHeight) / 2);
    return { x: Math.max(-maxX, Math.min(maxX, point.x)), y: Math.max(-maxY, Math.min(maxY, point.y)) };
  }

  function changeZoom(next: number) {
    const scale = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    if (scale >= MAX_ZOOM) void earn("enhance");
    setZoom(scale);
    setOffset((point) => (scale === MIN_ZOOM ? { x: 0, y: 0 } : clampOffset(point, scale)));
  }

  function resetView() {
    setZoom(MIN_ZOOM);
    setOffset({ x: 0, y: 0 });
    setDragging(false);
    setPinching(false);
    activePointers.current.clear();
    pinchStart.current = null;
  }

  const pointerHandlers = {
    onPointerDown(event: PointerEvent<HTMLDivElement>) {
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
    },
    onPointerMove(event: PointerEvent<HTMLDivElement>) {
      const previous = activePointers.current.get(event.pointerId);
      if (!previous) return;
      activePointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (activePointers.current.size === 2 && pinchStart.current) {
        const [a, b] = Array.from(activePointers.current.values());
        const distance = Math.hypot(a.x - b.x, a.y - b.y);
        const initial = pinchStart.current;
        if (initial.distance > 0) changeZoom((initial.zoom * distance) / initial.distance);
      } else if (zoom > MIN_ZOOM && activePointers.current.size === 1) {
        setOffset((point) => clampOffset({ x: point.x + event.clientX - previous.x, y: point.y + event.clientY - previous.y }, zoom));
      }
    },
    onPointerUp: end,
    onPointerCancel: end,
    onDoubleClick() { changeZoom(zoom > MIN_ZOOM ? MIN_ZOOM : 2); },
  };

  function end(event: PointerEvent<HTMLDivElement>) {
    activePointers.current.delete(event.pointerId);
    if (activePointers.current.size < 2) { pinchStart.current = null; setPinching(false); }
    if (activePointers.current.size === 0) setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
  }

  /** +/= zoom in, -/_ zoom out, 0 reset. Returns true if the key was handled. */
  function handleZoomKey(event: KeyboardEvent): boolean {
    if (event.key === "+" || event.key === "=") { changeZoom(zoom + ZOOM_STEP); return true; }
    if (event.key === "-" || event.key === "_") { changeZoom(zoom - ZOOM_STEP); return true; }
    if (event.key === "0") { resetView(); return true; }
    return false;
  }

  const imageStyle = {
    transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})`,
    transition: dragging || pinching ? "none" : "transform 120ms ease-out",
  };
  const cursor = zoom > MIN_ZOOM ? (dragging ? "grabbing" : "grab") : "zoom-in";

  return { imageRef, viewportRef, zoom, offset, changeZoom, resetView, pointerHandlers, handleZoomKey, imageStyle, cursor, zoomed: zoom > MIN_ZOOM };
}
