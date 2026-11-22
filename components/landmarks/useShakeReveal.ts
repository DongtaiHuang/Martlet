"use client";

// "Shake to reveal" for a landmark's photos (issue #17). Phone: shake (DeviceMotion; iOS asks
// permission once). Desktop: wiggle the mouse left-right over the photos. Remembered per landmark.
import { useCallback, useEffect, useRef, useState, useSyncExternalStore, type PointerEvent } from "react";

const key = (landmarkId: string) => `martlet.revealed.${landmarkId}`;
const listeners = new Set<() => void>();
const subscribe = (cb: () => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
const isRevealed = (landmarkId: string) => { try { return localStorage.getItem(key(landmarkId)) === "1"; } catch { return true; } };

type MotionPermission = { requestPermission?: () => Promise<"granted" | "denied"> };

export function useShakeReveal(landmarkId: string, enabled: boolean) {
  // Server snapshot = not revealed, so first-time viewers never get a flash of the photos.
  const revealed = useSyncExternalStore(subscribe, () => isRevealed(landmarkId), () => false);
  const [revealing, setRevealing] = useState(false);
  const [motion, setMotion] = useState<"unknown" | "needs-permission" | "on" | "off">("unknown");
  const wiggle = useRef<{ dir: number; lastX: number; flips: number[] }>({ dir: 0, lastX: 0, flips: [] });

  const reveal = useCallback(() => {
    if (isRevealed(landmarkId)) return;
    try { localStorage.setItem(key(landmarkId), "1"); } catch {}
    setRevealing(true);
    navigator.vibrate?.(60);
    listeners.forEach((l) => l());
    window.setTimeout(() => setRevealing(false), 1400);
  }, [landmarkId]);

  // Phone shake via the motion sensor.
  useEffect(() => {
    if (!enabled || revealed || typeof window === "undefined" || !("DeviceMotionEvent" in window)) return;
    // Only touch devices can be shaken; desktop browsers may still expose the permission API.
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const needsPermission = typeof (DeviceMotionEvent as unknown as MotionPermission).requestPermission === "function";
    if (needsPermission && motion !== "on") { if (motion === "unknown") queueMicrotask(() => setMotion("needs-permission")); return; }
    const peaks: number[] = [];
    const onMotion = (e: DeviceMotionEvent) => {
      const a = e.acceleration ?? e.accelerationIncludingGravity;
      if (!a) return;
      const g = e.acceleration ? 0 : 9.81;
      const mag = Math.abs(Math.hypot(a.x ?? 0, a.y ?? 0, a.z ?? 0) - g);
      const now = performance.now();
      if (mag > 14) { peaks.push(now); while (peaks.length && now - peaks[0] > 900) peaks.shift(); if (peaks.length >= 3) reveal(); }
    };
    window.addEventListener("devicemotion", onMotion);
    return () => window.removeEventListener("devicemotion", onMotion);
  }, [enabled, revealed, motion, reveal]);

  const enableMotion = useCallback(async () => {
    try {
      const res = await (DeviceMotionEvent as unknown as MotionPermission).requestPermission?.();
      setMotion(res === "granted" ? "on" : "off");
    } catch { setMotion("off"); }
  }, []);

  /** Desktop: four quick left-right direction changes over the wall count as a shake. */
  const onPointerMove = useCallback((e: PointerEvent<HTMLElement>) => {
    if (!enabled || revealed || e.pointerType !== "mouse") return;
    const w = wiggle.current, dx = e.clientX - w.lastX;
    w.lastX = e.clientX;
    if (Math.abs(dx) < 6) return;
    const dir = Math.sign(dx);
    if (w.dir && dir !== w.dir) {
      const now = performance.now();
      w.flips.push(now);
      while (w.flips.length && now - w.flips[0] > 700) w.flips.shift();
      if (w.flips.length >= 4) reveal();
    }
    w.dir = dir;
  }, [enabled, revealed, reveal]);

  return { revealed, revealing, reveal, onPointerMove, needsMotionPermission: motion === "needs-permission", enableMotion };
}
