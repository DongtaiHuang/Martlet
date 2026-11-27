"use client";

// Martlet Skies (ADR 0046): fly your pixel Marty over the real campus map. Visit landmark towers
// and fly over meetup spots. Single-player; nothing about your flight leaves the browser except
// the one achievement call when you've visited every landmark.
import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Map as MapLibre, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ArrowUp, Pause, Play } from "lucide-react";
import { earn } from "@/components/achievements/earn";
import { DEFAULT_LOOK, LOOK_KEY, plumageOf, readLook } from "@/components/avatar/look";
import { towerSvg, towerTier } from "@/components/map/landmark-tower";
import { initialMapStyle, trackMapStyle, useMapColorMode } from "@/components/map/map-mode";
import { showMcgillBuildings } from "@/components/map/mcgill-buildings";
import { collapseCredit } from "@/components/map/map-credit";
import "@/components/map/map-config"; // sets MapLibre's worker URL
import { Gamepad, HANDHELD_SCREEN, HANDHELD_SHELL, HandheldExit, useHandheld, type PadControl } from "@/components/pixel/Gamepad";
import { PixelSprite } from "@/components/pixel/PixelSprite";
import { spriteSvg } from "@/lib/pixel/sprite";
import { PIXEL_SIZE } from "@/components/pixel/pixel3d";
import { ALTITUDE, START, angleDiff, distanceM, nearest, step, zoomFor, type Bird, type Controls } from "./skies-math";
import { MEETUP_PIN, backFrames, type Wing } from "./skies-sprites";

export type SkiesLandmark = { id: string; name: string; latitude: number; longitude: number; radius_m: number; unlock_count: number; unlocked: boolean };
export type SkiesMeetup = { id: string; title: string; location_name: string; latitude: number; longitude: number; starts_at: string };

const VISITED_KEY = "martlet.skies.visited";
/** The Roddick Gates (OpenStreetMap), for the "Through the gates" achievement. */
const RODDICK_GATES = { lng: -73.574885, lat: 45.503889 };
const MEETUP_RADIUS = 45;
const PITCH = 62;
const BIRD_Y = 0.7; // the bird sits 70% of the way down the view; the map's centre is moved there

function readVisited(): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]") as string[]); } catch { return new Set(); }
}
function saveVisited(ids: Set<string>) {
  try { localStorage.setItem(VISITED_KEY, JSON.stringify([...ids])); } catch { /* not kept */ }
}
const timeFormat = new Intl.DateTimeFormat("en-CA", { weekday: "short", hour: "numeric", minute: "2-digit", timeZone: "America/Toronto" });

type State = "ready" | "flying" | "paused";

export default function MartletSkies({ landmarks, meetups }: { landmarks: SkiesLandmark[]; meetups: SkiesMeetup[] }) {
  const box = useRef<HTMLDivElement>(null);
  const mapEl = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibre | null>(null);
  useMapColorMode(mapRef);
  const birdEl = useRef<HTMLDivElement>(null);
  const shadowEl = useRef<HTMLDivElement>(null);
  const frameEls = useRef<Partial<Record<Wing, HTMLDivElement | null>>>({});
  const keys = useRef<Controls>({ left: false, right: false, up: false, down: false, boost: false });
  const birdRef = useRef<Bird>({ ...START });
  const stateRef = useRef<State>("ready");
  const visitedRef = useRef<Set<string>>(new Set());
  const markerEls = useRef(new Map<string, HTMLElement>());

  const [state, setState] = useState<State>("ready");
  const [plumage, setPlumage] = useState(() => plumageOf(DEFAULT_LOOK));
  const [visitedCount, setVisitedCount] = useState(0);
  const [toast, setToast] = useState<SkiesLandmark | null>(null);
  const [here, setHere] = useState<SkiesMeetup[]>([]);
  const [hud, setHud] = useState({ altitude: START.altitude, target: null as null | { name: string; distance: number; turn: number }, edge: false });

  const go = useCallback((next: State) => { stateRef.current = next; setState(next); }, []);

  // The student's plumage from the avatar studio, and their visits so far (this browser only).
  useEffect(() => {
    const load = () => setPlumage(plumageOf(readLook() ?? DEFAULT_LOOK));
    load();
    visitedRef.current = readVisited();
    setVisitedCount(landmarks.filter((l) => visitedRef.current.has(l.id)).length);
    const onStorage = (e: StorageEvent) => { if (e.key === LOOK_KEY) load(); };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [landmarks]);

  // The map: pixelated (a third of the resolution, smoothing off), no labels, not draggable.
  useEffect(() => {
    if (!mapEl.current) return;
    const style = initialMapStyle();
    const map = new MapLibre({
      container: mapEl.current, style, center: [START.lng, START.lat], zoom: zoomFor(START.altitude), pitch: PITCH, bearing: START.heading,
      pixelRatio: 1 / PIXEL_SIZE, interactive: false, fadeDuration: 0, maxPitch: 70, attributionControl: { compact: true },
    });
    trackMapStyle(map, style);
    showMcgillBuildings(map, "solid");
    // Street and place labels turn to mush when pixelated, and we label what matters ourselves.
    map.on("style.load", () => {
      for (const layer of map.getStyle().layers) if (layer.type === "symbol") map.setLayoutProperty(layer.id, "visibility", "none");
    });
    // Keep the map credit as its ⓘ button so the banner doesn't cover the touch controls.
    collapseCredit(map);
    const padTo = () => map.setPadding({ top: Math.round(map.getContainer().clientHeight * (2 * BIRD_Y - 1)), bottom: 0, left: 0, right: 0 });
    padTo();
    const ro = new ResizeObserver(() => { map.resize(); padTo(); });
    ro.observe(mapEl.current);

    const els = markerEls.current;
    for (const l of landmarks) {
      const el = document.createElement("div");
      el.className = "martlet-tower pointer-events-none";
      // Static markup: towerSvg only emits constant colours and numbers.
      el.innerHTML = towerSvg(towerTier(l.unlock_count), true, { cell: 3 });
      new Marker({ element: el, anchor: "bottom" }).setLngLat([l.longitude, l.latitude]).addTo(map);
      els.set(l.id, el);
    }
    for (const m of meetups) {
      const el = document.createElement("div");
      el.className = "pointer-events-none";
      el.innerHTML = spriteSvg(MEETUP_PIN, { width: MEETUP_PIN.w * 3, height: MEETUP_PIN.h * 3 });
      new Marker({ element: el, anchor: "bottom" }).setLngLat([m.longitude, m.latitude]).addTo(map);
    }
    mapRef.current = map;
    return () => { ro.disconnect(); map.remove(); els.clear(); mapRef.current = null; };
  }, [landmarks, meetups]);

  // Visited towers glow gold.
  useEffect(() => {
    markerEls.current.forEach((el, id) => { el.style.filter = visitedRef.current.has(id) ? "drop-shadow(0 0 4px #f5c84c) drop-shadow(0 0 2px #f5c84c)" : "drop-shadow(0 2px 2px rgba(0,0,0,.35))"; });
  }, [visitedCount]);

  // The game loop.
  useEffect(() => {
    let raf = 0, last = 0, t = 0, hudT = 0, toastTimer = 0;
    let hereKey = "";
    const tick = (now: number) => {
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now; t += dt;
      const map = mapRef.current;
      if (map && stateRef.current === "flying") {
        const next = step(birdRef.current, keys.current, dt);
        birdRef.current = next;
        if (next.altitude <= 50 && distanceM(next.lng, next.lat, RODDICK_GATES.lng, RODDICK_GATES.lat) <= 30) void earn("through-the-gates");
        if (next.altitude >= ALTITUDE.max - 0.5) void earn("cloud-nine");
        map.jumpTo({ center: [next.lng, next.lat], bearing: next.heading, zoom: zoomFor(next.altitude), pitch: PITCH });

        // Landmark visits.
        for (const l of landmarks) {
          if (visitedRef.current.has(l.id)) continue;
          if (distanceM(next.lng, next.lat, l.longitude, l.latitude) <= Math.max(35, l.radius_m)) {
            visitedRef.current.add(l.id);
            saveVisited(visitedRef.current);
            const count = landmarks.filter((x) => visitedRef.current.has(x.id)).length;
            setVisitedCount(count);
            setToast(l);
            window.clearTimeout(toastTimer);
            toastTimer = window.setTimeout(() => setToast(null), 6000);
            if (landmarks.length > 0 && count === landmarks.length) void earn("birds-eye-view");
          }
        }
        // Meetups right below.
        const close = meetups.filter((m) => distanceM(next.lng, next.lat, m.longitude, m.latitude) <= MEETUP_RADIUS);
        const key = close.map((m) => m.id).join();
        if (key !== hereKey) { hereKey = key; setHere(close); }

        // HUD a few times a second.
        hudT += dt;
        if (hudT > 0.2) {
          hudT = 0;
          const todo = landmarks.filter((l) => !visitedRef.current.has(l.id));
          const n = nearest(next, todo);
          setHud({ altitude: next.altitude, edge: next.atEdge, target: n ? { name: n.place.name, distance: n.distance, turn: angleDiff(next.heading, n.bearing) } : null });
        }
      }
      // Bird: flap faster when boosting, bank into turns, shadow shrinks with height.
      const k = keys.current;
      const flap = stateRef.current === "flying" ? Math.sin(t * (k.boost ? 22 : 13)) : Math.sin(t * 4) * 0.5;
      const wing: Wing = flap > 0.35 ? "up" : flap < -0.35 ? "down" : "mid";
      for (const w of ["up", "mid", "down"] as Wing[]) { const el = frameEls.current[w]; if (el) el.style.display = w === wing ? "block" : "none"; }
      const bank = stateRef.current === "flying" ? ((k.right ? 1 : 0) - (k.left ? 1 : 0)) * 14 : 0;
      const bob = Math.round(Math.sin(t * 3) * 3);
      if (birdEl.current) birdEl.current.style.transform = `translate(-50%, calc(-50% + ${bob}px)) rotate(${bank}deg)`;
      if (shadowEl.current) {
        const scale = 1.2 - (birdRef.current.altitude - 35) / 250;
        shadowEl.current.style.transform = `translate(-50%, 0) scale(${scale.toFixed(2)})`;
        shadowEl.current.style.opacity = String(Math.max(0.15, scale * 0.45));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); window.clearTimeout(toastTimer); };
  }, [landmarks, meetups]);

  // Keyboard: arrows/WASD steer and climb, Shift or Space boosts, P pauses. Only while the game
  // has focus, so the page still scrolls normally.
  useEffect(() => {
    const map: Record<string, keyof Controls> = {
      ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
      ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down", ShiftLeft: "boost", ShiftRight: "boost", Space: "boost",
    };
    const inGame = () => box.current?.contains(document.activeElement) ?? false;
    const down = (e: KeyboardEvent) => {
      if (!inGame()) return;
      if (e.code === "KeyP" || e.code === "Escape") { if (stateRef.current !== "ready") go(stateRef.current === "flying" ? "paused" : "flying"); return; }
      const c = map[e.code];
      if (!c) return;
      e.preventDefault();
      if (stateRef.current === "ready") go("flying");
      keys.current[c] = true;
    };
    const up = (e: KeyboardEvent) => { const c = map[e.code]; if (c) keys.current[c] = false; };
    const hide = () => { if (document.hidden && stateRef.current === "flying") go("paused"); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    document.addEventListener("visibilitychange", hide);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); document.removeEventListener("visibilitychange", hide); };
  }, [go]);

  // The gamepad (phones): D-pad steers and climbs, A boosts, B pauses.
  const onPad = useCallback((c: PadControl, on: boolean) => {
    if (c === "b") { if (on && stateRef.current !== "ready") go(stateRef.current === "flying" ? "paused" : "flying"); return; }
    if (on && stateRef.current !== "flying") go("flying");
    keys.current[c === "a" ? "boost" : c] = on;
  }, [go]);

  const start = () => { box.current?.focus({ preventScroll: true }); go("flying"); };
  const frames = backFrames(plumage);
  // Phones: full screen with the gamepad underneath once you take off, until you exit.
  const handheld = useHandheld(state !== "ready");
  const chip = "rounded-xl bg-black/50 px-3 py-1.5 text-xs font-bold text-white backdrop-blur-sm";

  return (
    <div className={handheld ? HANDHELD_SHELL : undefined}>
      <div ref={box} tabIndex={-1} aria-label="Martlet Skies. Arrow keys or WASD to steer and climb, Shift to boost, P to pause."
        className={`relative w-full overflow-hidden rounded-3xl bg-[#9cc3e6] outline-none focus-visible:ring-2 focus-visible:ring-focus ${handheld ? HANDHELD_SCREEN : "aspect-square sm:aspect-[16/10]"}`}>
        {/* MapLibre's CSS makes its container position: relative, so it fills a positioned wrapper. */}
        <div className="absolute inset-0" style={{ imageRendering: "pixelated" }} aria-hidden="true">
          <div ref={mapEl} className="size-full" />
        </div>

        {/* Marty and his shadow. */}
        <div ref={shadowEl} aria-hidden="true" className="pointer-events-none absolute left-1/2 h-3 w-16 rounded-[50%] bg-black" style={{ top: `calc(${BIRD_Y * 100}% + 48px)` }} />
        <div ref={birdEl} aria-hidden="true" className="pointer-events-none absolute left-1/2" style={{ top: `${BIRD_Y * 100}%` }}>
          {(["up", "mid", "down"] as Wing[]).map((w) => (
            <div key={w} ref={(el) => { frameEls.current[w] = el; }} style={{ display: w === "mid" ? "block" : "none" }}>
              <PixelSprite sprite={frames[w]} className="h-auto w-[104px] drop-shadow-[0_2px_0_rgb(0_0_0/0.25)] sm:w-[130px]" />
            </div>
          ))}
        </div>

        {/* HUD */}
        <div className="pointer-events-none absolute inset-x-3 top-3 flex flex-wrap items-start justify-between gap-2">
          <p className={chip}>Landmarks {visitedCount}/{landmarks.length}</p>
          {hud.target ? (
            <p className={`${chip} flex items-center gap-1.5`}>
              <ArrowUp aria-hidden="true" size={14} style={{ transform: `rotate(${Math.round(hud.target.turn)}deg)` }} />
              {hud.target.name} · {hud.target.distance < 1000 ? `${Math.round(hud.target.distance)} m` : `${(hud.target.distance / 1000).toFixed(1)} km`}
            </p>
          ) : landmarks.length > 0 && <p className={chip}>Every landmark visited! 🎉</p>}
          <p className={chip}>{Math.round(hud.altitude)} m up</p>
        </div>
        {hud.edge && <p className={`${chip} pointer-events-none absolute top-14 left-1/2 -translate-x-1/2`}>Edge of campus: turning back</p>}

        {/* A landmark visit. */}
        {toast && (
          <div role="status" className="absolute inset-x-3 top-14 mx-auto max-w-sm rounded-2xl bg-surface/95 p-3 text-sm text-ink shadow-xl">
            <p className="font-extrabold">Visited {toast.name}! 🪶</p>
            <p className="mt-0.5 text-ink-muted">{toast.unlocked ? "You’ve unlocked it for real too." : "Unlock it for real with a photo challenge on campus."}</p>
            <Link href={`/landmarks/${toast.id}`} className="pointer-events-auto mt-1 inline-flex min-h-11 items-center font-bold text-brand-ink underline">Open {toast.name}</Link>
          </div>
        )}

        {/* Meetups right below. */}
        {here.length > 0 && (
          <div className="absolute inset-x-3 bottom-24 mx-auto max-w-sm rounded-2xl bg-surface/95 p-3 text-sm text-ink shadow-xl sm:bottom-3">
            <p className="text-xs font-bold tracking-wide text-ink-muted uppercase">Meetups at {here[0].location_name}</p>
            <ul className="mt-1 grid gap-1">
              {here.slice(0, 3).map((m) => (
                <li key={m.id}><Link href={`/meetups/${m.id}`} className="inline-flex min-h-11 items-center gap-2 font-bold text-brand-ink hover:underline">{m.title} <span className="font-normal text-ink-muted">· {timeFormat.format(new Date(m.starts_at))}</span></Link></li>
              ))}
            </ul>
          </div>
        )}

        {state !== "flying" && (
          <div className="absolute inset-0 z-20 grid place-items-center bg-black/35 backdrop-blur-[1px]">
            {handheld && <HandheldExit onExit={() => go("ready")} />}
            <div className="mx-4 max-w-xs rounded-2xl bg-surface p-5 text-center text-ink shadow-xl">
              <p className="text-lg font-extrabold">{state === "paused" ? "Paused" : "Martlet Skies"}</p>
              {state === "ready" && <p className="mt-1 text-sm text-ink-muted">Fly over campus. Visit every landmark tower and find meetups from the air.</p>}
              <button type="button" onClick={start} autoFocus className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-brand px-5 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">
                <Play aria-hidden="true" size={16} /> {state === "paused" ? "Keep flying" : "Take off"}
              </button>
            </div>
          </div>
        )}
        {state === "flying" && (
          <button type="button" onClick={() => go("paused")} aria-label="Pause (P)" className="absolute top-12 right-3 grid size-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-sm focus-visible:outline-2 focus-visible:outline-white">
            <Pause aria-hidden="true" size={16} />
          </button>
        )}
      </div>
      <Gamepad onChange={onPad} a="Boost" b="Pause" title="Martlet Skies" handheld={handheld} />
      <p className={`mt-2 text-xs text-ink-muted ${handheld ? "hidden" : ""}`}>Visits are saved in this browser. Map data © OpenStreetMap contributors (OpenFreeMap).</p>
    </div>
  );
}
