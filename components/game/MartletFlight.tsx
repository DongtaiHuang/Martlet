"use client";

import { earn } from "@/components/achievements/earn";
import { startRunAction, submitScoreAction } from "@/app/play/actions";
import { FLIGHT_SCORE_EVENT } from "./FlightLeaderboard";

// Martlet Flight (issue #75): an original tap-to-fly mini-game. Fly the martlet between campus
// columns, collect landmark pins. Pixel art drawn on a small canvas and scaled up (ADR 0044);
// day scene in light mode, night in dark mode.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useColorMode } from "@/lib/useColorMode";
import { DEFAULT_LOOK, LOOK_KEY, plumageOf, readLook, type AvatarLook } from "@/components/avatar/look";
import { ART, drawScene } from "./flight-scene";

// Logical playfield (scaled to fit the container).
const W = 360, H = 600, GROUND = 70;
const GRAVITY = 1500, FLAP = -470, MAX_FALL = 620;
const BIRD_X = 96, BIRD_R = 14;
const COL_W = 62, GAP_START = 168, GAP_MIN = 132, SPACING = 214;
const SPEED_START = 150, SPEED_MAX = 250;
const BEST_KEY = "martlet.flight.best";

type Column = { x: number; gapY: number; gap: number; passed: boolean; pin: { y: number; taken: boolean } | null };
type State = "ready" | "playing" | "paused" | "over";

function readBest() { try { return Number(localStorage.getItem(BEST_KEY)) || 0; } catch { return 0; } }
function saveBest(n: number) { try { localStorage.setItem(BEST_KEY, String(n)); } catch {} }

/** `embedded`: shown inside another page (the feed), so keys only act while the game has focus
 *  and play pauses when it scrolls out of view. */
export default function MartletFlight({ embedded = false }: { embedded?: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const embeddedRef = useRef(embedded);
  // Embedded: the game owns Space/↑ after you click/tap/focus it, until you interact elsewhere.
  // (Not document.activeElement: Start/Fly again unmount after a click, dropping focus to <body>.)
  const engagedRef = useRef(false);
  const mode = useColorMode();
  const [state, setState] = useState<State>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const flapRef = useRef<() => void>(() => {});
  const stateRef = useRef<State>("ready");
  const runRef = useRef<Promise<string | null> | null>(null);
  const modeRef = useRef(mode);
  const lookRef = useRef<AvatarLook>(DEFAULT_LOOK);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { queueMicrotask(() => setBest(readBest())); }, []);
  // The look saved by the avatar studio; follows changes made in another tab.
  useEffect(() => {
    lookRef.current = readLook() ?? DEFAULT_LOOK;
    const onStorage = (event: StorageEvent) => { if (event.key === LOOK_KEY) lookRef.current = readLook() ?? DEFAULT_LOOK; };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;
    // The art canvas: one pixel per art pixel, scaled up with smoothing off.
    const art = document.createElement("canvas");
    art.width = W / ART; art.height = H / ART;
    const ag = art.getContext("2d");
    if (!ag) return;

    let bird = { y: H * 0.42, vy: 0 };
    let cols: Column[] = [];
    let speed = SPEED_START, distance = 0, points = 0, t = 0, last = 0, raf = 0, wingT = 0;

    const reset = () => {
      bird = { y: H * 0.42, vy: 0 }; cols = []; speed = SPEED_START; distance = 0; points = 0;
      setScore(0);
    };
    const spawn = (x: number) => {
      const gap = Math.max(GAP_MIN, GAP_START - points * 2);
      const gapY = 90 + Math.random() * (H - GROUND - 180 - gap) + gap / 2;
      cols.push({ x, gapY, gap, passed: false, pin: Math.random() < 0.55 ? { y: gapY + (Math.random() - 0.5) * gap * 0.4, taken: false } : null });
    };

    const resize = () => {
      const rect = canvas.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr); canvas.height = Math.round(rect.height * dpr);
      g.imageSmoothingEnabled = false;
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    flapRef.current = () => {
      const s = stateRef.current;
      if (s === "ready" || s === "over") {
        // Leaderboard (ADR 0026): the server times the run; guests just get null.
        runRef.current = startRunAction().catch(() => null);
        reset(); for (let i = 0; i < 3; i++) spawn(W + 60 + i * SPACING); setState("playing"); stateRef.current = "playing"; }
      if (stateRef.current === "playing") { bird.vy = FLAP; wingT = 0; }
    };

    const die = () => {
      stateRef.current = "over"; setState("over");
      if (points >= 10) void earn("high-flyer");
      const final = points, run = runRef.current; runRef.current = null;
      if (run && final > 0) void run.then((id) => id && submitScoreAction(id, final)).then((r) => { if (r === "new-best" || r === "saved") window.dispatchEvent(new Event(FLIGHT_SCORE_EVENT)); }).catch(() => {});
      setBest((b) => { const nb = Math.max(b, points); if (nb > b) saveBest(nb); return nb; });
    };

    const draw = () => {
      const playing = stateRef.current === "playing";
      const flap = playing ? Math.sin(wingT * 22) : Math.sin(t * 6) * 0.6;
      const look = lookRef.current;
      drawScene(ag, {
        mode: modeRef.current, W, H, GROUND, COL_W, t, distance, cols,
        bird: { x: BIRD_X, y: bird.y, wing: flap > 0.33 ? "up" : flap < -0.33 ? "down" : "mid" },
        look: { plumage: plumageOf(look), wearing: look.wearing },
        score: stateRef.current === "ready" ? null : points,
      });
      g.drawImage(art, 0, 0, canvas.width, canvas.height);
    };

    const step = (now: number) => {
      const dt = Math.min(0.033, last ? (now - last) / 1000 : 0); last = now; t += dt;
      const s = stateRef.current;
      if (s === "ready") bird.y = H * 0.42 + Math.sin(t * 3) * 8;
      if (s === "playing") {
        wingT += dt; speed = Math.min(SPEED_MAX, SPEED_START + points * 3);
        bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * dt); bird.y += bird.vy * dt;
        distance += speed * dt;
        for (const c of cols) c.x -= speed * dt;
        if (cols.length && cols[0].x < -COL_W - 10) cols.shift();
        const lastCol = cols[cols.length - 1];
        if (!lastCol || lastCol.x < W + 60 - SPACING) spawn((lastCol?.x ?? W) + SPACING);
        for (const c of cols) {
          if (!c.passed && c.x + COL_W < BIRD_X - BIRD_R) { c.passed = true; points += 1; setScore(points); }
          if (c.pin && !c.pin.taken && Math.hypot(c.x + COL_W / 2 - BIRD_X, c.pin.y - bird.y) < BIRD_R + 9) { c.pin.taken = true; points += 2; setScore(points); }
          const inX = BIRD_X + BIRD_R - 4 > c.x - 6 && BIRD_X - BIRD_R + 4 < c.x + COL_W + 6;
          if (inX && (bird.y - BIRD_R + 3 < c.gapY - c.gap / 2 || bird.y + BIRD_R - 3 > c.gapY + c.gap / 2)) die();
        }
        if (bird.y + BIRD_R > H - GROUND || bird.y < -40) die();
      }
      if (s === "over" && bird.y + BIRD_R < H - GROUND) { bird.vy = Math.min(MAX_FALL, bird.vy + GRAVITY * dt); bird.y = Math.min(H - GROUND - BIRD_R, bird.y + bird.vy * dt); }
      draw();
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);

    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
      if (embeddedRef.current && !engagedRef.current) return;
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); if (stateRef.current !== "paused") flapRef.current(); }
      if (e.code === "KeyP") { const s = stateRef.current; if (s === "playing" || s === "paused") { const n = s === "playing" ? "paused" : "playing"; stateRef.current = n; setState(n); } }
    };
    const onHide = () => { if (document.hidden && stateRef.current === "playing") { stateRef.current = "paused"; setState("paused"); } };
    window.addEventListener("keydown", onKey);
    const engage = (e: Event) => { engagedRef.current = !!boxRef.current?.parentElement?.contains(e.target as Node); };
    document.addEventListener("pointerdown", engage, true);
    document.addEventListener("focusin", engage);
    const io = embeddedRef.current ? new IntersectionObserver(([en]) => { if (!en.isIntersecting && stateRef.current === "playing") { stateRef.current = "paused"; setState("paused"); } }) : null;
    if (io && boxRef.current) io.observe(boxRef.current);
    document.addEventListener("visibilitychange", onHide);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); io?.disconnect(); window.removeEventListener("keydown", onKey); document.removeEventListener("pointerdown", engage, true); document.removeEventListener("focusin", engage); document.removeEventListener("visibilitychange", onHide); };
  }, []);

  const btn = "inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  const resume = () => { stateRef.current = "playing"; setState("playing"); };

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div ref={boxRef} tabIndex={-1} className="relative overflow-hidden rounded-3xl shadow-lg ring-1 ring-line outline-none" style={{ aspectRatio: `${W} / ${H}` }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none"
          aria-label="Martlet Flight game. Press Space, the Up arrow, or tap to flap."
          onPointerDown={(e) => { e.preventDefault(); boxRef.current?.focus({ preventScroll: true }); if (stateRef.current !== "paused") flapRef.current(); }}
        />
        {state === "ready" && (
          <div className="absolute inset-x-0 bottom-24 flex flex-col items-center gap-3 text-center">
            <p className="rounded-full bg-black/45 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur">Tap, click or press Space to flap</p>
            <button type="button" onClick={() => flapRef.current()} className={`${btn} bg-brand text-on-brand hover:bg-brand-hover`}><Play aria-hidden="true" size={16} /> Start</button>
          </div>
        )}
        {state === "paused" && (
          <div className="absolute inset-0 grid place-items-center bg-black/40 backdrop-blur-sm">
            <button type="button" onClick={resume} className={`${btn} bg-surface text-ink`}><Play aria-hidden="true" size={16} /> Resume</button>
          </div>
        )}
        {state === "over" && (
          <div className="absolute inset-0 grid place-items-center bg-black/35 backdrop-blur-[2px]">
            <div className="w-64 rounded-2xl bg-surface p-5 text-center shadow-xl">
              <p className="text-sm font-semibold tracking-wide text-ink-muted uppercase">Grounded!</p>
              <p className="mt-1 text-4xl font-black text-ink tabular-nums">{score}</p>
              <p className="text-sm text-ink-muted">Best <span className="font-bold text-ink tabular-nums">{best}</span>{score > 0 && score >= best && " · new record!"}</p>
              <button type="button" autoFocus={!embedded} onClick={() => flapRef.current()} className={`${btn} mt-4 w-full justify-center bg-brand text-on-brand hover:bg-brand-hover`}><RotateCcw aria-hidden="true" size={16} /> Fly again</button>
            </div>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center justify-between text-sm text-ink-muted">
        <p role="status" aria-live="polite">{state === "over" ? `Game over. Score ${score}, best ${best}.` : <>Score <span className="font-bold text-ink tabular-nums">{score}</span></>}</p>
        <div className="flex items-center gap-3">
          <span>Best <span className="font-bold text-ink tabular-nums">{best}</span></span>
          {(state === "playing" || state === "paused") && (
            <button type="button" onClick={() => { const n = state === "playing" ? "paused" : "playing"; stateRef.current = n; setState(n); }} aria-label={state === "playing" ? "Pause (P)" : "Resume (P)"} className="inline-grid size-11 place-items-center rounded-full ring-1 ring-line hover:text-ink focus-visible:outline-2 focus-visible:outline-focus">
              {state === "playing" ? <Pause aria-hidden="true" size={16} /> : <Play aria-hidden="true" size={16} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
