"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";
import { X } from "lucide-react";
import { PixelSprite } from "./PixelSprite";
import { buttonSprite, dirsAt, dpadSprite, type Dir } from "./gamepad-sprites";

export type PadControl = Dir | "a" | "b";

const COARSE = "(pointer: coarse)";
const subscribe = (onChange: () => void) => { const mq = window.matchMedia(COARSE); mq.addEventListener("change", onChange); return () => mq.removeEventListener("change", onChange); };
const isCoarse = () => window.matchMedia(COARSE).matches;

/** True on touch screens, where the gamepad replaces the keyboard. */
export function useTouchScreen() {
  return useSyncExternalStore(subscribe, isCoarse, () => false);
}

/**
 * Phones: while a game is on (started, paused or showing its result), it fills the screen with the
 * gamepad underneath, like a handheld, so the game and the controls are both in view. The page
 * behind stops scrolling. Returns whether handheld mode is on.
 */
export function useHandheld(active: boolean) {
  const on = useTouchScreen() && active;
  useEffect(() => {
    if (!on) return;
    const root = document.documentElement;
    const before = root.style.overflow;
    root.style.overflow = "hidden";
    root.dataset.handheld = "";
    return () => { root.style.overflow = before; delete root.dataset.handheld; };
  }, [on]);
  return on;
}

/** The full-screen frame for handheld mode: the game on top, the gamepad below. */
export const HANDHELD_SHELL = "fixed inset-0 z-[70] flex flex-col gap-2 bg-[#2a1016] px-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))]";
/** The game's screen in handheld mode: it takes the room above the gamepad. */
export const HANDHELD_SCREEN = "min-h-0 flex-1";

/** Leaves handheld mode, back to the page. */
export function HandheldExit({ onExit }: { onExit: () => void }) {
  return (
    <button type="button" onClick={onExit}
      className="absolute top-2 left-2 z-40 inline-flex min-h-11 items-center gap-1 rounded-full bg-black/55 px-3 text-sm font-bold text-white backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-white">
      <X aria-hidden="true" size={16} /> Exit
    </button>
  );
}

const buzz = () => { try { navigator.vibrate?.(8); } catch { /* not supported */ } };

/**
 * A pixel-art handheld gamepad for phones (ADR 0044): a D-pad on the left and A/B buttons on the
 * right, the same layout in every game. Multi-touch: steer with one thumb while holding A or B.
 * `onChange` reports each control as it's pressed and released. Renders nothing on screens with
 * a mouse unless `always` is set.
 */
export function Gamepad({ onChange, a, b, title, always = false, handheld = false }: {
  onChange: (control: PadControl, pressed: boolean) => void;
  /** What A and B do in this game, shown under the buttons (e.g. "Boost", "Pause"). */
  a: string;
  b: string;
  title?: string;
  always?: boolean;
  /** Inside the handheld frame: no top margin or title, so the game gets the room. */
  handheld?: boolean;
}) {
  const touch = useTouchScreen();
  const [pressed, setPressed] = useState<ReadonlySet<PadControl>>(new Set());
  const dirs = useRef(new Set<Dir>());
  const shown = touch || always;

  // While a gamepad is on screen, the floating Marty steps aside (globals.css) so he doesn't
  // sit on the D-pad.
  useEffect(() => {
    if (!shown) return;
    const root = document.documentElement;
    root.dataset.gamepad = "";
    return () => { delete root.dataset.gamepad; };
  }, [shown]);

  const set = useCallback((control: PadControl, on: boolean) => {
    setPressed((prev) => {
      if (prev.has(control) === on) return prev;
      const next = new Set(prev);
      if (on) next.add(control); else next.delete(control);
      return next;
    });
    if (on) buzz();
    onChange(control, on);
  }, [onChange]);

  // D-pad: the direction comes from where the thumb is, so it can slide and press diagonals.
  const track = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const next = dirsAt((e.clientX - (r.left + r.width / 2)) / (r.width / 2), (e.clientY - (r.top + r.height / 2)) / (r.height / 2));
    for (const d of dirs.current) if (!next.has(d)) set(d, false);
    for (const d of next) if (!dirs.current.has(d)) set(d, true);
    dirs.current = next;
  };
  const releaseDirs = () => { for (const d of dirs.current) set(d, false); dirs.current = new Set(); };

  if (!shown) return null;
  const padDirs = new Set([...pressed].filter((c): c is Dir => c !== "a" && c !== "b"));
  const button = (which: "a" | "b", label: string, offset: string) => (
    <div className={`flex flex-col items-center gap-1 ${offset}`}>
      <button type="button" aria-label={`${which.toUpperCase()}: ${label}`}
        className="relative grid size-16 select-none place-items-center [touch-action:none] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); set(which, true); }}
        onPointerUp={() => set(which, false)} onPointerCancel={() => set(which, false)} onLostPointerCapture={() => set(which, false)}
        onContextMenu={(e) => e.preventDefault()}>
        <PixelSprite sprite={buttonSprite(which, pressed.has(which))} className={`absolute inset-0 size-full transition-transform ${pressed.has(which) ? "translate-y-0.5" : ""}`} />
        <span aria-hidden="true" className={`relative font-mono text-xl font-black text-[#39131d] ${pressed.has(which) ? "translate-y-0.5" : ""}`}>{which.toUpperCase()}</span>
      </button>
      <span className="text-[11px] font-bold tracking-wide text-[#fce8d5] uppercase">{label}</span>
    </div>
  );

  return (
    <div className={`${handheld ? "" : "mt-3 "}shrink-0 select-none rounded-[1.75rem] border-4 border-[#39131d] bg-[#9c2334] px-4 pt-3 pb-4 shadow-[inset_0_4px_0_#b23a4a,inset_0_-6px_0_#751e2c,0_6px_14px_rgb(0_0_0/0.25)]`}
      onContextMenu={(e) => e.preventDefault()}>
      {title && !handheld && <p aria-hidden="true" className="mb-2 text-center font-mono text-[11px] font-black tracking-[0.25em] text-[#fce8d5]/80 uppercase">{title}</p>}
      <div className="flex items-center justify-between gap-4">
        <div role="group" aria-label="Direction pad"
          className="size-32 shrink-0 [touch-action:none]"
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); track(e); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) track(e); }}
          onPointerUp={releaseDirs} onPointerCancel={releaseDirs} onLostPointerCapture={releaseDirs}>
          <PixelSprite sprite={dpadSprite(padDirs)} className="size-full" />
        </div>
        <div className="flex items-end gap-3">
          {button("b", b, "mb-0")}
          {button("a", a, "mb-6")}
        </div>
      </div>
    </div>
  );
}
