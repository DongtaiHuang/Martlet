"use client";

// Martlet Flight (issue #75): an original tap-to-fly mini-game. Fly the martlet between campus
// columns, collect landmark pins. Canvas-rendered; day scene in light mode, night in dark mode.
import { useEffect, useRef, useState } from "react";
import { Pause, Play, RotateCcw } from "lucide-react";
import { useColorMode } from "@/lib/useColorMode";

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

const PALETTE = {
  light: { skyTop: "#9fd4f5", skyBottom: "#fdf2df", mountain: "#8fae8b", cross: "#ffffff", city: "#c9c2b8", cityWindow: "#f4efe7", ground: "#7aa35a", path: "#b5835a", brick: "#9c6b45", col: "#d9d0c3", colShade: "#b9ad9c", banner: "#a6192e", text: "#1f2937", star: "transparent" },
  dark: { skyTop: "#0b1430", skyBottom: "#2a2340", mountain: "#1e2b2a", cross: "#ffe9a8", city: "#191726", cityWindow: "#ffd36b", ground: "#2f4a2a", path: "#5a4636", brick: "#4a3829", col: "#6b665f", colShade: "#4f4a44", banner: "#c42a2a", text: "#f3efec", star: "#ffffff" },
};

function drawMartlet(g: CanvasRenderingContext2D, x: number, y: number, tilt: number, wing: number) {
  g.save(); g.translate(x, y); g.rotate(tilt);
  // forked tail
  g.fillStyle = "#151d33";
  g.beginPath(); g.moveTo(-10, 2); g.lineTo(-30, -6); g.lineTo(-22, 3); g.lineTo(-31, 12); g.closePath(); g.fill();
  // body + belly
  g.fillStyle = "#1f2a44"; g.beginPath(); g.ellipse(0, 0, 17, 12, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#f7f3ea"; g.beginPath(); g.ellipse(4, 4, 11, 7, 0, 0, Math.PI * 2); g.fill();
  // wing (flaps)
  g.fillStyle = "#151d33"; g.beginPath(); g.ellipse(-3, -2 + wing * 6, 11, 6, -0.4 + wing * 0.9, 0, Math.PI * 2); g.fill();
  // head, red throat, eye, beak
  g.fillStyle = "#1f2a44"; g.beginPath(); g.arc(12, -6, 9, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#a6192e"; g.beginPath(); g.ellipse(14, 1, 5, 3, 0, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#fff"; g.beginPath(); g.arc(15, -8, 3.4, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#111"; g.beginPath(); g.arc(16, -8, 1.8, 0, Math.PI * 2); g.fill();
  g.fillStyle = "#e3a835"; g.beginPath(); g.moveTo(20, -6); g.lineTo(28, -4); g.lineTo(20, -2); g.closePath(); g.fill();
  g.restore();
}

function drawColumn(g: CanvasRenderingContext2D, x: number, top: number, bottom: number, p: typeof PALETTE.light) {
  const drawPart = (y0: number, y1: number, capAtBottom: boolean) => {
    g.fillStyle = p.col; g.fillRect(x, y0, COL_W, y1 - y0);
    g.fillStyle = p.colShade; g.fillRect(x + COL_W - 12, y0, 12, y1 - y0);
    for (let s = x + 10; s < x + COL_W - 12; s += 12) { g.fillStyle = p.colShade; g.fillRect(s, y0, 2, y1 - y0); } // fluting
    const capY = capAtBottom ? y1 - 16 : y0;
    g.fillStyle = p.colShade; g.fillRect(x - 6, capY, COL_W + 12, 16);
    g.fillStyle = p.banner; g.fillRect(x + 8, capAtBottom ? capY - 22 : capY + 16, COL_W - 22, 22);
    g.fillStyle = "#fff"; g.fillRect(x + 8, capAtBottom ? capY - 22 : capY + 16 + 18, COL_W - 22, 4);
  };
  drawPart(-20, top, true);
  drawPart(bottom, H - GROUND + 4, false);
}

export default function MartletFlight() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mode = useColorMode();
  const [state, setState] = useState<State>("ready");
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const flapRef = useRef<() => void>(() => {});
  const stateRef = useRef<State>("ready");
  const modeRef = useRef(mode);

  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { stateRef.current = state; }, [state]);
  useEffect(() => { queueMicrotask(() => setBest(readBest())); }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const g = canvas.getContext("2d");
    if (!g) return;

    let bird = { y: H * 0.42, vy: 0 };
    let cols: Column[] = [];
    let speed = SPEED_START, distance = 0, points = 0, t = 0, last = 0, raf = 0, wingT = 0;
    const stars = Array.from({ length: 40 }, (_, i) => ({ x: (i * 97) % W, y: (i * 53) % (H * 0.5), r: (i % 3) * 0.5 + 0.6 }));

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
      g.setTransform(canvas.width / W, 0, 0, canvas.height / H, 0, 0);
    };
    resize();
    const ro = new ResizeObserver(resize); ro.observe(canvas);

    flapRef.current = () => {
      const s = stateRef.current;
      if (s === "ready" || s === "over") { reset(); for (let i = 0; i < 3; i++) spawn(W + 60 + i * SPACING); setState("playing"); stateRef.current = "playing"; }
      if (stateRef.current === "playing") { bird.vy = FLAP; wingT = 0; }
    };

    const die = () => {
      stateRef.current = "over"; setState("over");
      setBest((b) => { const nb = Math.max(b, points); if (nb > b) saveBest(nb); return nb; });
    };

    const draw = () => {
      const p = PALETTE[modeRef.current];
      const sky = g.createLinearGradient(0, 0, 0, H); sky.addColorStop(0, p.skyTop); sky.addColorStop(1, p.skyBottom);
      g.fillStyle = sky; g.fillRect(0, 0, W, H);
      if (modeRef.current === "dark") { g.fillStyle = p.star; for (const s of stars) { g.globalAlpha = 0.5 + 0.5 * Math.sin(t * 2 + s.x); g.fillRect((s.x - distance * 0.02 + W) % W, s.y, s.r, s.r); } g.globalAlpha = 1; g.fillStyle = "#f4f1e8"; g.beginPath(); g.arc(W - 60, 70, 18, 0, Math.PI * 2); g.fill(); }
      // Mount Royal + cross (slow parallax)
      const mx = -((distance * 0.08) % (W * 1.6));
      for (const off of [0, W * 1.6]) {
        g.fillStyle = p.mountain; g.beginPath(); g.moveTo(mx + off - 40, H - GROUND - 60);
        g.quadraticCurveTo(mx + off + 160, H - GROUND - 230, mx + off + 420, H - GROUND - 70); g.lineTo(mx + off + 420, H - GROUND); g.lineTo(mx + off - 40, H - GROUND); g.fill();
        g.fillStyle = p.cross; g.fillRect(mx + off + 174, H - GROUND - 172, 3, 26); g.fillRect(mx + off + 167, H - GROUND - 164, 17, 3);
      }
      // campus silhouettes (mid parallax)
      const cx = -((distance * 0.3) % 240);
      for (let i = 0; i < 4; i++) {
        const bx = cx + i * 240;
        g.fillStyle = p.city;
        g.fillRect(bx, H - GROUND - 90, 70, 90); g.fillRect(bx + 90, H - GROUND - 120, 60, 120);
        g.beginPath(); g.arc(bx + 120, H - GROUND - 120, 22, Math.PI, 0); g.fill(); // dome
        g.fillRect(bx + 170, H - GROUND - 70, 50, 70);
        g.fillStyle = p.cityWindow; for (let wy = 0; wy < 3; wy++) for (let wx = 0; wx < 3; wx++) g.fillRect(bx + 10 + wx * 20, H - GROUND - 78 + wy * 24, 8, 10);
      }
      // columns + pins
      for (const c of cols) {
        drawColumn(g, c.x, c.gapY - c.gap / 2, c.gapY + c.gap / 2, p);
        if (c.pin && !c.pin.taken) {
          const py = c.pin.y + Math.sin(t * 4 + c.x) * 4, px = c.x + COL_W / 2;
          g.fillStyle = "#f2c14e"; g.beginPath(); g.arc(px, py - 4, 8, Math.PI, 0); g.lineTo(px, py + 10); g.closePath(); g.fill();
          g.fillStyle = "#fff"; g.beginPath(); g.arc(px, py - 4, 3, 0, Math.PI * 2); g.fill();
        }
      }
      // ground: grass + scrolling brick path
      g.fillStyle = p.ground; g.fillRect(0, H - GROUND, W, 16);
      g.fillStyle = p.path; g.fillRect(0, H - GROUND + 16, W, GROUND - 16);
      g.fillStyle = p.brick; const bo = -(distance % 28);
      for (let row = 0; row < 3; row++) for (let bx = bo + (row % 2) * 14; bx < W; bx += 28) g.fillRect(bx, H - GROUND + 22 + row * 16, 24, 2);
      // bird
      const wing = stateRef.current === "playing" ? Math.sin(wingT * 22) : Math.sin(t * 6) * 0.6;
      const tilt = stateRef.current === "ready" ? 0 : Math.max(-0.5, Math.min(1.2, bird.vy / 600));
      if (modeRef.current === "dark") { // moonlit glow so the navy bird reads against the night sky
        const glow = g.createRadialGradient(BIRD_X + 4, bird.y, 4, BIRD_X + 4, bird.y, 34);
        glow.addColorStop(0, "rgba(255,240,200,0.45)"); glow.addColorStop(1, "rgba(255,240,200,0)");
        g.fillStyle = glow; g.beginPath(); g.arc(BIRD_X + 4, bird.y, 34, 0, Math.PI * 2); g.fill();
      }
      drawMartlet(g, BIRD_X, bird.y, tilt, wing);
      // score
      if (stateRef.current !== "ready") {
        g.font = "800 44px system-ui, sans-serif"; g.textAlign = "center"; g.lineWidth = 6; g.strokeStyle = "rgba(0,0,0,.35)";
        g.strokeText(String(points), W / 2, 72); g.fillStyle = "#fff"; g.fillText(String(points), W / 2, 72);
      }
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
      if (e.code === "Space" || e.code === "ArrowUp" || e.code === "KeyW") { e.preventDefault(); if (stateRef.current !== "paused") flapRef.current(); }
      if (e.code === "KeyP") { const s = stateRef.current; if (s === "playing" || s === "paused") { const n = s === "playing" ? "paused" : "playing"; stateRef.current = n; setState(n); } }
    };
    const onHide = () => { if (document.hidden && stateRef.current === "playing") { stateRef.current = "paused"; setState("paused"); } };
    window.addEventListener("keydown", onKey);
    document.addEventListener("visibilitychange", onHide);
    return () => { cancelAnimationFrame(raf); ro.disconnect(); window.removeEventListener("keydown", onKey); document.removeEventListener("visibilitychange", onHide); };
  }, []);

  const btn = "inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-sm font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus";
  const resume = () => { stateRef.current = "playing"; setState("playing"); };

  return (
    <div className="mx-auto w-full max-w-[420px]">
      <div className="relative overflow-hidden rounded-3xl shadow-lg ring-1 ring-line" style={{ aspectRatio: `${W} / ${H}` }}>
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none select-none"
          aria-label="Martlet Flight game. Press Space, the Up arrow, or tap to flap."
          onPointerDown={(e) => { e.preventDefault(); if (stateRef.current !== "paused") flapRef.current(); }}
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
              <button type="button" autoFocus onClick={() => flapRef.current()} className={`${btn} mt-4 w-full justify-center bg-brand text-on-brand hover:bg-brand-hover`}><RotateCcw aria-hidden="true" size={16} /> Fly again</button>
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
