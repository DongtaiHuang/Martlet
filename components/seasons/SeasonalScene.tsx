"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type AnimationEvent, type CSSProperties } from "react";
import { earn } from "@/components/achievements/earn";
import { COIN, DUCK, GOAT, LANTERN, LEAVES, RED_POCKET, SAND_TILE, SNOW_MOUND, SNOWMAN_FULL, SNOWMAN_STAGES, WATER_POOL, WATER_TILE, type Sprite } from "./season-sprites";

/*
 * Seasonal decorations for the Winter and Fall themes (app/theme.css). Purely decorative and
 * client-only; nothing is stored. Mounted once in the root layout, so piles and snowmen
 * persist while you move between pages and reset on reload.
 *
 * - Behind the page content: winter moonlight (moon, glow, shimmer); falling pixel leaves.
 *   (Winter's falling snow is CSS, in app/theme.css.)
 * - Along the bottom of the screen: leaf piles and snowmen that build up over time. Click a
 *   leaf pile to make it dissolve, or a snowman to melt it. They keep clear of Marty's nest.
 * - Marty joins in (he's found by [data-marty] in FlyingMartlet.tsx): he breaks snowmen he
 *   hops or is dragged through, scatters leaf piles when dragged through them, and once the
 *   ground is deep enough he now and then burrows: a mound appears, he dives in, pops his head
 *   out, hops out, and the mound bursts (the "martlet:burrow" event; FlyingMartlet does the dive).
 */

// ---- Shared helpers ----------------------------------------------------------------------

function subscribeTheme(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => observer.disconnect();
}
const getTheme = () => document.documentElement.dataset.theme ?? "";

function subscribeWidth(callback: () => void) {
  window.addEventListener("resize", callback);
  return () => window.removeEventListener("resize", callback);
}
const getWidth = () => window.innerWidth;

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Spots along the bottom for piles and snowmen, keeping clear of Marty's nest on the left. */
function bottomSlots(width: number, spacing: number, max: number): number[] {
  const start = 200, end = width - 48;
  const count = Math.max(1, Math.min(max, Math.floor((end - start) / spacing)));
  return Array.from({ length: count }, (_, i) => start + ((i + 0.5) * (end - start)) / count);
}

/** Where Marty is right now, from the DOM (FlyingMartlet owns him; we only look). */
type MartyState = { rect: DOMRect; dragging: boolean; nest: string };
function readMarty(): MartyState | null {
  const body = document.querySelector("[data-marty] svg");
  if (!body) return null;
  return {
    rect: body.getBoundingClientRect(),
    dragging: document.querySelector('.martlet-drag-offset[data-dragging="true"]') !== null,
    nest: document.querySelector(".martlet-stage")?.getAttribute("data-nest") ?? "away",
  };
}

/** Run `tick` on every animation frame while mounted (paused in background tabs by the browser). */
function useFrameLoop(tick: (now: number) => void) {
  const latest = useRef(tick);
  useEffect(() => { latest.current = tick; });
  useEffect(() => {
    let frame = requestAnimationFrame(function loop(now) {
      latest.current(now);
      frame = requestAnimationFrame(loop);
    });
    return () => cancelAnimationFrame(frame);
  }, []);
}

/** Ground cover must reach this depth (0..1) before Marty burrows. */
const BURROW_DEPTH = 0.6;
const BURROW_MS = 3200; // the whole dive; FlyingMartlet.tsx times its animation to this
const BURROW_LEAVE_AT = 0.86; // when he hops out and the mound bursts
const BURST_MS = 900;

type Burrow = { left: number; top: number; width: number; height: number; leaving: boolean };

/**
 * Burrowing, now and then once the ground cover is deep: a mound appears around Marty, he dives
 * in, pops his head out, hops out, and the mound bursts. Only while he's on the ground, not
 * dragged or napping, and never with reduced motion. Call `step` every frame.
 */
function useBurrow(deep: () => boolean, where: (rect: DOMRect) => boolean = () => true) {
  const [burrow, setBurrow] = useState<Burrow | null>(null);
  const busy = useRef(false);
  const nextAt = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  function step(marty: MartyState | null, now: number) {
    if (busy.current || !marty || now < nextAt.current || !deep() || reducedMotion()) return;
    const { rect } = marty;
    const bottom = window.innerHeight;
    if (marty.dragging || marty.nest !== "away" || rect.bottom < bottom - 90 || !where(rect)) return;
    busy.current = true;
    const top = rect.bottom - rect.height * 0.35; // tall enough to hide him once he dives
    setBurrow({ left: rect.left - rect.width * 0.2, width: rect.width * 1.4, top, height: bottom - top, leaving: false });
    window.dispatchEvent(new CustomEvent("martlet:burrow", { detail: { ms: BURROW_MS } }));
    timers.current.push(
      setTimeout(() => setBurrow((current) => current && { ...current, leaving: true }), BURROW_MS * BURROW_LEAVE_AT),
      setTimeout(() => {
        setBurrow(null);
        busy.current = false;
        nextAt.current = performance.now() + 9_000 + Math.random() * 8_000; // the next one
      }, BURROW_MS * BURROW_LEAVE_AT + BURST_MS),
    );
  }
  return { burrow, step, busy: () => busy.current };
}

// Leaf litter along the bottom: a repeating strip of small leaves (built from the sprites).
const LITTER_TILE = (() => {
  const picks = [[0, 0, 2], [5, 10, 1], [2, 19, 3], [6, 28, 0]]; // [sprite, x, y]
  const body = picks.map(([s, x, y]) => `<g transform="translate(${x} ${y % 4})">${LEAVES[s].paths.map((p) => `<path fill="${p.fill}" d="${p.d}"/>`).join("")}</g>`).join("");
  return `url("data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="38" height="12" shape-rendering="crispEdges">${body}</svg>`)}")`;
})();
const LITTER_FULL = 66; // landed leaves for a full layer; burrowing starts at 60% (~40 leaves)

// The leaf mound Marty burrows into: rows of leaves from its top edge down to the ground,
// [sprite, x%, top%]. The top row is narrower, so it's a mound with a tidy edge.
const LEAF_DRIFT = [
  [0, 14, 0], [5, 28, -4], [2, 42, 0], [7, 56, -4], [1, 70, 0],
  [3, 4, 22], [6, 18, 24], [4, 32, 20], [0, 46, 24], [5, 60, 20], [2, 74, 24], [7, 86, 22],
  [1, 0, 46], [4, 12, 48], [7, 25, 44], [3, 38, 48], [6, 51, 44], [0, 64, 48], [2, 77, 44], [5, 88, 48],
  [6, 2, 70], [2, 15, 72], [5, 28, 68], [1, 41, 72], [4, 54, 68], [7, 67, 72], [3, 80, 68], [0, 90, 72],
];

function PixelSprite({ sprite, scale, className, style }: { sprite: Sprite; scale: number; className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox={`0 0 ${sprite.w} ${sprite.h}`} width={sprite.w * scale} height={sprite.h * scale} shapeRendering="crispEdges" aria-hidden="true" className={className} style={style}>
      {sprite.paths.map((p) => <path key={p.fill} fill={p.fill} d={p.d} />)}
    </svg>
  );
}

export function SeasonalScene() {
  const theme = useSyncExternalStore(subscribeTheme, getTheme, () => "");
  if (theme === "winter") return <WinterScene />;
  if (theme === "fall") return <FallScene />;
  if (theme === "summer") return <SummerScene />;
  if (theme === "cny") return <NewYearScene />;
  return null;
}

// ---- Fall: falling leaves that pile up --------------------------------------------------

type FallingLeaf = { id: number; x: number; leaf: number; fall: number; sway: number };
type PileLeaf = { leaf: number; turn: number };
type Pile = { leaves: PileLeaf[]; clearing: boolean };
/** A leaf Marty knocked out of a pile, tumbling from (x, y) by (dx, dy) px. */
type FlyingLeaf = { id: number; leaf: number; x: number; y: number; dx: number; dy: number; spin: number };

const MAX_FALLING = 24;
const PILE_MAX = 26;
const PILE_ROWS = [7, 6, 5, 4, 3, 1]; // leaves per row, bottom to top
const DISSOLVE_MS = 3000; // matches .season-pile-clear in globals.css
const LEAF_SCALE = 2;
const PILE_HALF_WIDTH = 72; // px; piles are 9rem wide
const SCATTER_EVERY_MS = 120;

function FallScene() {
  const width = useSyncExternalStore(subscribeWidth, getWidth, () => 0);
  const slots = useMemo(() => bottomSlots(width, 210, 6), [width]);
  const [falling, setFalling] = useState<FallingLeaf[]>([]);
  const [piles, setPiles] = useState<Record<number, Pile>>({});
  const [flying, setFlying] = useState<FlyingLeaf[]>([]);
  const [landed, setLanded] = useState(0); // leaves that have reached the ground
  const litter = Math.min(1, landed / LITTER_FULL);
  const litterRef = useRef(litter);
  useEffect(() => { litterRef.current = litter; }, [litter]);
  const { burrow, step: burrowStep } = useBurrow(() => litterRef.current >= BURROW_DEPTH);
  const nextId = useRef(0);
  const slotsRef = useRef(slots);
  const pilesRef = useRef(piles);
  useEffect(() => { slotsRef.current = slots; }, [slots]);
  useEffect(() => { pilesRef.current = piles; }, [piles]);

  function addToPile(index: number, leaf: number) {
    setPiles((current) => {
      const pile = current[index] ?? { leaves: [], clearing: false };
      if (pile.clearing || pile.leaves.length >= PILE_MAX) return current;
      return { ...current, [index]: { ...pile, leaves: [...pile.leaves, { leaf, turn: Math.floor(Math.random() * 4) }] } };
    });
  }

  function nearestPile(x: number) {
    let nearest = -1, best = 130;
    slotsRef.current.forEach((slotX, i) => { const d = Math.abs(slotX - x); if (d < best) { best = d; nearest = i; } });
    return nearest;
  }

  // Plenty of leaves: one every ~0.45 s, falling in 5–8 s (fewer on small screens), so the
  // litter is deep enough for Marty to burrow in well under 45 s. With reduced motion nothing
  // falls; the piles and litter just grow slowly in place.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      const leaf = Math.floor(Math.random() * LEAVES.length);
      if (reducedMotion()) {
        setLanded((count) => count + 1);
        if (Math.random() < 0.3) addToPile(Math.floor(Math.random() * slotsRef.current.length), leaf);
        return;
      }
      setFalling((current) => current.length >= MAX_FALLING ? current : [...current, {
        id: nextId.current++,
        x: 12 + Math.random() * (window.innerWidth - 40),
        leaf,
        fall: 5 + Math.random() * 3,
        sway: 2 + Math.random() * 1.6,
      }]);
    }, window.innerWidth < 640 ? 800 : 450);
    return () => clearInterval(timer);
  }, []);

  // A leaf that lands near a pile joins it; others just settle and disappear.
  function land(event: AnimationEvent, leaf: FallingLeaf) {
    if (event.target !== event.currentTarget) return;
    setFalling((current) => current.filter((f) => f.id !== leaf.id));
    setLanded((count) => count + 1);
    const pile = nearestPile(leaf.x);
    if (pile >= 0) addToPile(pile, leaf.leaf);
  }

  // A knocked-out leaf lands in whichever pile it reaches, or blows away.
  function settle(event: AnimationEvent, leaf: FlyingLeaf) {
    if (event.target !== event.currentTarget) return;
    setFlying((current) => current.filter((f) => f.id !== leaf.id));
    const pile = nearestPile(leaf.x + leaf.dx);
    if (pile >= 0) addToPile(pile, leaf.leaf);
  }

  function sweep(index: number) {
    void earn("leaf-blower");
    setPiles((current) => ({ ...current, [index]: { ...current[index], clearing: true } }));
    setTimeout(() => setPiles((current) => ({ ...current, [index]: { leaves: [], clearing: false } })), DISSOLVE_MS);
  }

  // Dragging Marty through a pile knocks leaves out in the direction he's moving.
  const lastMarty = useRef<{ x: number; at: number } | null>(null);
  const lastScatter = useRef(0);
  useFrameLoop((now) => {
    const marty = readMarty();
    burrowStep(marty, now);
    if (!marty) return;
    const x = marty.rect.left + marty.rect.width / 2;
    const previous = lastMarty.current;
    lastMarty.current = { x, at: now };
    if (!marty.dragging || reducedMotion() || now - lastScatter.current < SCATTER_EVERY_MS) return;
    const pileTop = window.innerHeight - 64;
    if (marty.rect.bottom < pileTop) return; // flying above the piles
    const moving = previous ? x - previous.x : 0;
    const direction = moving === 0 ? (Math.random() < 0.5 ? -1 : 1) : Math.sign(moving);
    slotsRef.current.forEach((slotX, index) => {
      const pile = pilesRef.current[index];
      if (!pile || pile.clearing || !pile.leaves.length) return;
      if (marty.rect.right < slotX - PILE_HALF_WIDTH || marty.rect.left > slotX + PILE_HALF_WIDTH) return;
      lastScatter.current = now;
      const knocked = pile.leaves.slice(-Math.min(3, pile.leaves.length));
      setPiles((current) => ({ ...current, [index]: { ...current[index], leaves: current[index].leaves.slice(0, -knocked.length) } }));
      setFlying((current) => [...current, ...knocked.map((leaf) => ({
        id: nextId.current++,
        leaf: leaf.leaf,
        x: slotX + (Math.random() - 0.5) * 60,
        y: 20 + Math.random() * 25,
        dx: direction * (90 + Math.random() * 170) + Math.abs(moving) * direction * 2,
        dy: -(40 + Math.random() * 60),
        spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
      }))]);
    });
  });

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {falling.map((f) => (
          <span
            key={f.id}
            className="season-leaf-fall absolute top-0"
            style={{ left: f.x, animationDuration: `${f.fall}s` }}
            onAnimationEnd={(event) => land(event, f)}
          >
            <span className="season-leaf-sway block" style={{ animationDuration: `${f.sway}s` }}>
              <PixelSprite sprite={LEAVES[f.leaf]} scale={LEAF_SCALE} />
            </span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-0">
        <div aria-hidden="true" className="season-leaf-ground absolute inset-x-0 bottom-0" style={{ height: litter * 14, backgroundImage: LITTER_TILE }} />
        {slots.map((x, index) => {
          const pile = piles[index];
          if (!pile?.leaves.length) return null;
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              aria-label="Sweep away the leaf pile"
              disabled={pile.clearing}
              onClick={() => sweep(index)}
              className={`pointer-events-auto absolute bottom-0 h-20 w-36 -translate-x-1/2 cursor-pointer ${pile.clearing ? "season-pile-clear" : ""}`}
              style={{ left: x }}
            >
              {pile.leaves.map((leaf, i) => {
                // Stack the leaves into a mound: fill the bottom row first.
                let row = 0, slot = i;
                while (row < PILE_ROWS.length - 1 && slot >= PILE_ROWS[row]) { slot -= PILE_ROWS[row]; row++; }
                const across = PILE_ROWS[row];
                const offset = (slot - (across - 1) / 2) * 14 + ((i * 7) % 5) - 2;
                return (
                  <PixelSprite
                    key={i}
                    sprite={LEAVES[leaf.leaf]}
                    scale={LEAF_SCALE}
                    className="season-pile-leaf absolute"
                    style={{ left: `calc(50% + ${offset}px - 9px)`, bottom: row * 8 - 2, transform: `rotate(${leaf.turn * 90}deg)`, "--dissolve-delay": `${(i % 6) * 120}ms` } as CSSProperties}
                  />
                );
              })}
            </button>
          );
        })}
        {flying.map((f) => (
          <span
            key={f.id}
            aria-hidden="true"
            className="season-leaf-scatter absolute"
            style={{ left: f.x - 9, bottom: f.y, "--dx": `${f.dx}px`, "--dy": `${f.dy}px`, "--spin": `${f.spin}deg` } as CSSProperties}
            onAnimationEnd={(event) => settle(event, f)}
          >
            <PixelSprite sprite={LEAVES[f.leaf]} scale={LEAF_SCALE} />
          </span>
        ))}
      </div>
      {/* The leaf mound Marty burrows into: above him (z-40) so it hides him; never catches clicks. */}
      {burrow && (
        <div
          data-burrow="leaves"
          aria-hidden="true"
          className={`pointer-events-none fixed z-[45] ${burrow.leaving ? "season-burrow-leave" : "season-burrow-in"}`}
          style={{ left: burrow.left, top: burrow.top, width: burrow.width, height: burrow.height }}
        >
          {LEAF_DRIFT.map(([sprite, x, y], i) => (
            <PixelSprite
              key={i}
              sprite={LEAVES[sprite]}
              scale={LEAF_SCALE}
              className="season-burrow-leaf absolute"
              style={{ left: `${x}%`, top: `${y}%`, transform: `rotate(${(i % 4) * 90}deg)`, "--dx": `${(x - 45) * 2.2 + ((i * 37) % 21) - 10}px`, "--dy": `${-40 - ((i * 53) % 50)}px`, "--spin": `${((i * 97) % 2 ? 1 : -1) * (120 + ((i * 41) % 240))}deg` } as CSSProperties}
            />
          ))}
        </div>
      )}
    </>
  );
}

// ---- Winter: moonlight, a snowy ground and snowmen ---------------------------------------

type Snowman = { stage: number; melting: boolean; breaking: boolean }; // stage -1 = nothing yet
const MELT_MS = 3800; // matches .season-melt in globals.css
const BREAK_MS = 900; // matches .season-break in globals.css
const EMPTY: Snowman = { stage: -1, melting: false, breaking: false };
// Chunks of snow that fly off a snowman Marty breaks: [dx, dy] in px.
const CHUNKS = [[-34, -46], [-18, -70], [6, -78], [26, -58], [38, -30], [-40, -18], [16, -36], [-8, -52]];

function WinterScene() {
  const width = useSyncExternalStore(subscribeWidth, getWidth, () => 0);
  const slots = useMemo(() => bottomSlots(width, 280, 4), [width]);
  const scale = width < 640 ? 2.4 : 3;
  const [ground, setGround] = useState(0); // 0..1 depth of the snow along the bottom
  const [snowmen, setSnowmen] = useState<Record<number, Snowman>>({});
  const snowmenRef = useRef(snowmen);
  const groundRef = useRef(ground);
  const slotsRef = useRef(slots);
  const scaleRef = useRef(scale);
  useEffect(() => { snowmenRef.current = snowmen; }, [snowmen]);
  useEffect(() => { groundRef.current = ground; }, [ground]);
  useEffect(() => { slotsRef.current = slots; scaleRef.current = scale; }, [slots, scale]);

  // Every few seconds the snow gets a little deeper (deep enough to burrow in ~40 s) and
  // snowmen build up a stage at a time (about a minute from mound to dressed snowman).
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      setGround((depth) => Math.min(1, depth + 0.07)); // deep enough to burrow after ~40 s
      setSnowmen((current) => {
        const next = { ...current };
        for (let i = 0; i < 4; i++) {
          const man = next[i] ?? EMPTY;
          if (man.melting || man.breaking || man.stage >= SNOWMAN_FULL) continue;
          if (Math.random() < (man.stage < 0 ? 0.35 : 0.6)) next[i] = { ...man, stage: man.stage + 1 };
        }
        return next;
      });
    }, 4500);
    return () => clearInterval(timer);
  }, []);

  function melt(index: number) {
    void earn("snow-day");
    setSnowmen((current) => ({ ...current, [index]: { ...current[index], melting: true } }));
    setTimeout(() => setSnowmen((current) => ({ ...current, [index]: EMPTY })), MELT_MS);
  }

  function smash(index: number) {
    setSnowmen((current) => ({ ...current, [index]: { ...current[index], breaking: true } }));
    setTimeout(() => setSnowmen((current) => ({ ...current, [index]: EMPTY })), BREAK_MS);
  }

  // Marty breaks any snowman he crosses, and now and then burrows once the snow is deep.
  const { burrow, step: burrowStep } = useBurrow(() => groundRef.current >= BURROW_DEPTH);
  useFrameLoop((now) => {
    const marty = readMarty();
    burrowStep(marty, now);
    if (!marty) return;
    const { rect } = marty;
    const bottom = window.innerHeight;
    slotsRef.current.forEach((x, index) => {
      const man = snowmenRef.current[index];
      if (!man || man.stage < 1 || man.melting || man.breaking) return;
      const sprite = SNOWMAN_STAGES[man.stage];
      const half = (sprite.w * scaleRef.current) / 2;
      const top = bottom - sprite.h * scaleRef.current;
      const centre = rect.left + rect.width / 2;
      if (centre > x - half && centre < x + half && rect.bottom > top + 8) {
        snowmenRef.current = { ...snowmenRef.current, [index]: { ...man, breaking: true } }; // don't smash twice
        smash(index);
      }
    });
  });

  return (
    <>
      <div aria-hidden="true" className="season-moonlight pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="season-moon" />
        <div className="season-shimmer" />
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-0">
        <div aria-hidden="true" className="season-snow-ground absolute inset-x-0 bottom-0" style={{ height: ground * 14 }} />
        {slots.map((x, index) => {
          const man = snowmen[index];
          if (!man || man.stage < 0) return null;
          const sprite = SNOWMAN_STAGES[man.stage];
          const clickable = man.stage >= 1 && !man.melting && !man.breaking;
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              aria-label="Melt the snowman"
              disabled={!clickable}
              onClick={() => melt(index)}
              className={`absolute bottom-0 -translate-x-1/2 ${clickable ? "pointer-events-auto cursor-pointer" : ""}`}
              style={{ left: x }}
            >
              {/* Re-keyed per stage so each new part pops in. */}
              <PixelSprite key={man.stage} sprite={sprite} scale={scale} className={`block ${man.breaking ? "season-break" : man.melting ? "season-melt" : "season-pop"}`} />
              {man.melting && <span aria-hidden="true" className="season-puddle absolute bottom-0 left-1/2 -translate-x-1/2" />}
              {man.breaking && CHUNKS.map(([dx, dy], i) => (
                <span key={i} aria-hidden="true" className="season-chunk absolute left-1/2" style={{ bottom: 18 + (i % 3) * 14, "--dx": `${dx}px`, "--dy": `${dy}px` } as CSSProperties} />
              ))}
            </button>
          );
        })}
      </div>
      {/* The snow mound Marty burrows into: above him (z-40) so it hides him; never catches clicks. */}
      {burrow && (
        <div
          data-burrow="snow"
          aria-hidden="true"
          className={`pointer-events-none fixed z-[45] ${burrow.leaving ? "" : "season-burrow-in"}`}
          style={{ left: burrow.left, top: burrow.top, width: burrow.width, height: burrow.height }}
        >
          {/* Fluffy pixel snowdrift with square pixels, centred on Marty. Its top pixel row is
              empty, so it's sized to hang that row above the box: the snow's visible top then
              sits exactly where it needs to be to hide him. */}
          <PixelSprite
            sprite={SNOW_MOUND}
            scale={burrow.height / (SNOW_MOUND.h - 1)}
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${burrow.leaving ? "season-break" : ""}`}
          />
          {burrow.leaving && CHUNKS.map(([dx, dy], i) => (
            <span key={i} aria-hidden="true" className="season-chunk absolute left-1/2" style={{ top: 6 + (i % 3) * 8, "--dx": `${dx}px`, "--dy": `${dy}px` } as CSSProperties} />
          ))}
        </div>
      )}
    </>
  );
}

// ---- Summer: a beach, rubber duckies, and splashing ---------------------------------------

type FallingDuck = { id: number; x: number; fall: number; sway: number };
type FloatingDuck = { id: number; x: number; bob: number; popping: boolean };

const SHORE = 200; // px of beach on the left, under Marty's nest; water to the right of it
const MAX_FALLING_DUCKS = 5;
const MAX_FLOATING_DUCKS = 14;
const DUCK_SCALE = 2.4;
const POP_MS = 450; // matches .season-duck-pop in globals.css
const PECK_MS = 600;
const SPLASH_AFTER_MS = 22_000; // first splash once the beach has been running a while
// Droplets thrown up when Marty splashes in or out: [dx, dy] in px.
const DROPS = [[-30, -40], [-16, -62], [4, -70], [22, -52], [34, -30], [-38, -16], [12, -34], [-6, -48]];

function SummerScene() {
  const [falling, setFalling] = useState<FallingDuck[]>([]);
  const [floating, setFloating] = useState<FloatingDuck[]>([]);
  const floatingRef = useRef(floating);
  useEffect(() => { floatingRef.current = floating; }, [floating]);
  const nextId = useRef(0);
  const startedAt = useRef<number | null>(null);

  function addDuck(x: number) {
    setFloating((current) => current.length >= MAX_FLOATING_DUCKS ? current : [...current, {
      id: nextId.current++, x: Math.max(SHORE + 20, Math.min(window.innerWidth - 40, x)), bob: 1.8 + Math.random() * 1.2, popping: false,
    }]);
  }

  // Ducks drift down slowly, one every ~2.6 s, taking 11–15 s to fall.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.hidden) return;
      const x = 12 + Math.random() * (window.innerWidth - 50);
      if (reducedMotion()) {
        if (x > SHORE) addDuck(x);
        return;
      }
      setFalling((current) => current.length >= MAX_FALLING_DUCKS ? current : [...current, {
        id: nextId.current++, x, fall: 11 + Math.random() * 4, sway: 2.6 + Math.random() * 1.4,
      }]);
    }, 2600);
    return () => clearInterval(timer);
  }, []);

  // A duck that lands on the water floats there; one that lands on the sand just disappears.
  function land(event: AnimationEvent, duck: FallingDuck) {
    if (event.target !== event.currentTarget) return;
    setFalling((current) => current.filter((d) => d.id !== duck.id));
    if (duck.x > SHORE) addDuck(duck.x);
  }

  function pop(id: number) {
    void earn("rubber-ducky");
    setFloating((current) => current.map((d) => d.id === id ? { ...d, popping: true } : d));
    setTimeout(() => setFloating((current) => current.filter((d) => d.id !== id)), POP_MS);
  }

  // Marty splashes into the water now and then (over the water, not the beach) and pecks any
  // duck he reaches: he stops, pecks twice, and the duck pops.
  const { burrow: splash, step: splashStep, busy: splashing } = useBurrow(
    () => startedAt.current !== null && performance.now() - startedAt.current > SPLASH_AFTER_MS,
    (rect) => rect.left > SHORE,
  );
  const nextPeck = useRef(0);
  useFrameLoop((now) => {
    startedAt.current ??= now;
    const marty = readMarty();
    splashStep(marty, now);
    if (!marty || splashing() || now < nextPeck.current || reducedMotion()) return;
    const { rect } = marty;
    if (marty.dragging || marty.nest !== "away" || rect.bottom < window.innerHeight - 90) return;
    const facingLeft = document.querySelector("[data-marty]")?.parentElement?.dataset.direction === "left";
    const beak = facingLeft ? rect.left + rect.width * 0.12 : rect.right - rect.width * 0.12;
    const duck = floatingRef.current.find((d) => !d.popping && Math.abs(d.x - beak) < 20);
    if (!duck) return;
    nextPeck.current = now + PECK_MS + 500;
    window.dispatchEvent(new CustomEvent("martlet:peck", { detail: { ms: PECK_MS } }));
    floatingRef.current = floatingRef.current.map((d) => d.id === duck.id ? { ...d, popping: true } : d); // don't peck twice
    setTimeout(() => pop(duck.id), PECK_MS * 0.7); // pops on the second peck
  });

  return (
    <>
      {/* Daytime sun: a warm glow and slowly turning rays in the top-left (hidden in dark mode). */}
      <div aria-hidden="true" className="season-sunlight pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="season-rays" />
        <div className="season-sun" />
      </div>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {falling.map((d) => (
          <span key={d.id} className="season-leaf-fall absolute top-0" style={{ left: d.x, animationDuration: `${d.fall}s` }} onAnimationEnd={(event) => land(event, d)}>
            <span className="season-duck-sway block" style={{ animationDuration: `${d.sway}s` }}>
              <PixelSprite sprite={DUCK} scale={DUCK_SCALE} />
            </span>
          </span>
        ))}
      </div>
      <div className="season-beach pointer-events-none fixed inset-x-0 bottom-0 z-30 h-0">
        {/* Sand under the nest, then water with rolling waves. */}
        <div aria-hidden="true" className="season-sand absolute bottom-0 left-0" style={{ width: SHORE + 30, backgroundImage: SAND_TILE }} />
        <div aria-hidden="true" className="season-water absolute right-0 bottom-0" style={{ left: SHORE, backgroundImage: WATER_TILE }} />
        {floating.map((d) => (
          <button
            key={d.id}
            type="button"
            tabIndex={-1}
            aria-label="Pop the rubber duck"
            disabled={d.popping}
            onClick={() => pop(d.id)}
            className={`pointer-events-auto absolute bottom-1.5 -translate-x-1/2 cursor-pointer ${d.popping ? "season-duck-pop" : "season-duck-bob"}`}
            style={{ left: d.x, animationDuration: d.popping ? undefined : `${d.bob}s` }}
          >
            <PixelSprite sprite={DUCK} scale={DUCK_SCALE} className="block" />
          </button>
        ))}
      </div>
      {/* The water Marty splashes into: above him (z-40) so it hides him; never catches clicks. */}
      {splash && (
        <div
          data-burrow="water"
          aria-hidden="true"
          className={`pointer-events-none fixed z-[45] ${splash.leaving ? "" : "season-burrow-in"}`}
          style={{ left: splash.left, top: splash.top, width: splash.width, height: splash.height }}
        >
          <PixelSprite
            sprite={WATER_POOL}
            scale={splash.height / (WATER_POOL.h - 1)}
            className={`absolute bottom-0 left-1/2 -translate-x-1/2 ${splash.leaving ? "season-break" : ""}`}
          />
          {/* A splash going in and another coming out (re-keyed so each plays). */}
          <span key={splash.leaving ? "out" : "in"}>
            {DROPS.map(([dx, dy], i) => (
              <span key={i} className="season-chunk season-drop absolute left-1/2" style={{ top: 4 + (i % 3) * 6, "--dx": `${dx}px`, "--dy": `${dy}px` } as CSSProperties} />
            ))}
          </span>
        </div>
      )}
    </>
  );
}

// ---- Chinese New Year: lanterns, goats and red pockets -------------------------------------

type Drifter = { id: number; x: number; kind: "lantern" | "goat"; fall: number; sway: number };
type FallingPocket = { id: number; x: number; fall: number; sway: number };
type PocketMound = { count: number; opening: boolean };
/** A gold coin flying out of a mound from (x, y) by (dx, dy) px. */
type FlyingCoin = { id: number; x: number; y: number; dx: number; dy: number; spin: number };

const MAX_DRIFTERS = 24; // lanterns and goats on screen at once (half that on phones)
const MAX_FALLING_POCKETS = 8;
const MOUND_MAX = 13;
const MOUND_ROWS = [5, 4, 3, 1]; // pockets per row, bottom to top
const POCKET_SCALE = 2.2;
const OPEN_MS = 900; // a clicked mound bursts open (matches .season-mound-open)
const PECK_COOLDOWN_MS = 1400;

function NewYearScene() {
  const width = useSyncExternalStore(subscribeWidth, getWidth, () => 0);
  const slots = useMemo(() => bottomSlots(width, 220, 5), [width]);
  const [drifters, setDrifters] = useState<Drifter[]>([]);
  const [pockets, setPockets] = useState<FallingPocket[]>([]);
  const [mounds, setMounds] = useState<Record<number, PocketMound>>({});
  const [coins, setCoins] = useState<FlyingCoin[]>([]);
  const nextId = useRef(0);
  const slotsRef = useRef(slots);
  const moundsRef = useRef(mounds);
  useEffect(() => { slotsRef.current = slots; }, [slots]);
  useEffect(() => { moundsRef.current = mounds; }, [mounds]);

  function addPocket(index: number) {
    setMounds((current) => {
      const mound = current[index] ?? { count: 0, opening: false };
      if (mound.opening || mound.count >= MOUND_MAX) return current;
      return { ...current, [index]: { ...mound, count: mound.count + 1 } };
    });
  }

  function burstCoins(x: number, count: number) {
    setCoins((current) => [...current, ...Array.from({ length: count }, () => ({
      id: nextId.current++,
      x: x + (Math.random() - 0.5) * 40,
      y: 16 + Math.random() * 20,
      dx: (Math.random() - 0.5) * 180,
      dy: -(60 + Math.random() * 90),
      spin: (Math.random() < 0.5 ? -1 : 1) * (180 + Math.random() * 360),
    }))]);
  }

  // Lanterns and goats drift down behind the page (they don't pile up); red pockets fall and
  // pile into mounds along the bottom. With reduced motion nothing falls; mounds just grow.
  useEffect(() => {
    const small = window.innerWidth < 640;
    const drift = setInterval(() => {
      if (document.hidden || reducedMotion()) return;
      setDrifters((current) => current.length >= (small ? MAX_DRIFTERS / 2 : MAX_DRIFTERS) ? current : [...current, {
        id: nextId.current++,
        x: 12 + Math.random() * (window.innerWidth - 60),
        kind: Math.random() < 0.6 ? "lantern" : "goat",
        fall: 10 + Math.random() * 5,
        sway: 2.8 + Math.random() * 1.6,
      }]);
    }, small ? 900 : 480);
    const pocket = setInterval(() => {
      if (document.hidden) return;
      if (reducedMotion()) {
        if (Math.random() < 0.4) addPocket(Math.floor(Math.random() * slotsRef.current.length));
        return;
      }
      setPockets((current) => current.length >= MAX_FALLING_POCKETS ? current : [...current, {
        id: nextId.current++, x: 12 + Math.random() * (window.innerWidth - 40), fall: 7 + Math.random() * 3, sway: 2 + Math.random() * 1.4,
      }]);
    }, 1100);
    return () => { clearInterval(drift); clearInterval(pocket); };
  }, []);

  function pocketLanded(event: AnimationEvent, pocket: FallingPocket) {
    if (event.target !== event.currentTarget) return;
    setPockets((current) => current.filter((p) => p.id !== pocket.id));
    let nearest = -1, best = 130;
    slotsRef.current.forEach((x, i) => { const d = Math.abs(x - pocket.x); if (d < best) { best = d; nearest = i; } });
    if (nearest >= 0) addPocket(nearest);
  }

  // Clicking a mound opens every pocket: coins burst out, the mound disappears, and the
  // hidden "Lucky red pocket" achievement is earned.
  function open(index: number) {
    const mound = moundsRef.current[index];
    if (!mound || mound.opening) return;
    burstCoins(slotsRef.current[index], Math.min(16, 4 + mound.count));
    setMounds((current) => ({ ...current, [index]: { ...current[index], opening: true } }));
    setTimeout(() => setMounds((current) => ({ ...current, [index]: { count: 0, opening: false } })), OPEN_MS);
    void earn("red-pocket");
  }

  // Marty pecks a mound he reaches: coins fly out and a pocket or two is gone.
  const nextPeck = useRef(0);
  useFrameLoop((now) => {
    const marty = readMarty();
    if (!marty || now < nextPeck.current || reducedMotion()) return;
    const { rect } = marty;
    if (marty.dragging || marty.nest !== "away" || rect.bottom < window.innerHeight - 90) return;
    const facingLeft = document.querySelector("[data-marty]")?.parentElement?.dataset.direction === "left";
    const beak = facingLeft ? rect.left + rect.width * 0.12 : rect.right - rect.width * 0.12;
    const index = slotsRef.current.findIndex((x, i) => {
      const mound = moundsRef.current[i];
      return mound && !mound.opening && mound.count > 0 && Math.abs(x - beak) < 40;
    });
    if (index < 0) return;
    nextPeck.current = now + PECK_COOLDOWN_MS;
    window.dispatchEvent(new CustomEvent("martlet:peck", { detail: { ms: PECK_MS } }));
    setTimeout(() => {
      burstCoins(slotsRef.current[index], 5);
      setMounds((current) => {
        const mound = current[index];
        return mound ? { ...current, [index]: { ...mound, count: Math.max(0, mound.count - 2) } } : current;
      });
    }, PECK_MS * 0.7);
  });

  return (
    <>
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        {drifters.map((d) => (
          <span
            key={d.id}
            className="season-leaf-fall absolute top-0"
            style={{ left: d.x, animationDuration: `${d.fall}s` }}
            onAnimationEnd={(event) => { if (event.target === event.currentTarget) setDrifters((current) => current.filter((x) => x.id !== d.id)); }}
          >
            <span className="season-duck-sway block" style={{ animationDuration: `${d.sway}s` }}>
              <PixelSprite sprite={d.kind === "lantern" ? LANTERN : GOAT} scale={d.kind === "lantern" ? 3 : 2.6} />
            </span>
          </span>
        ))}
        {pockets.map((p) => (
          <span key={p.id} className="season-leaf-fall absolute top-0" style={{ left: p.x, animationDuration: `${p.fall}s` }} onAnimationEnd={(event) => pocketLanded(event, p)}>
            <span className="season-leaf-sway block" style={{ animationDuration: `${p.sway}s` }}>
              <PixelSprite sprite={RED_POCKET} scale={POCKET_SCALE} />
            </span>
          </span>
        ))}
      </div>
      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 h-0">
        {slots.map((x, index) => {
          const mound = mounds[index];
          if (!mound?.count) return null;
          return (
            <button
              key={index}
              type="button"
              tabIndex={-1}
              aria-label="Open the red pockets"
              disabled={mound.opening}
              onClick={() => open(index)}
              className={`pointer-events-auto absolute bottom-0 h-20 w-32 -translate-x-1/2 cursor-pointer ${mound.opening ? "season-mound-open" : ""}`}
              style={{ left: x }}
            >
              {Array.from({ length: mound.count }, (_, i) => {
                let row = 0, slot = i;
                while (row < MOUND_ROWS.length - 1 && slot >= MOUND_ROWS[row]) { slot -= MOUND_ROWS[row]; row++; }
                const offset = (slot - (MOUND_ROWS[row] - 1) / 2) * 20 + ((i * 5) % 3) - 1;
                return (
                  <PixelSprite
                    key={i}
                    sprite={RED_POCKET}
                    scale={POCKET_SCALE}
                    className="season-pile-leaf absolute"
                    style={{ left: `calc(50% + ${offset}px - 11px)`, bottom: row * 15 - 2, transform: `rotate(${((i * 7) % 5 - 2) * 6}deg)` }}
                  />
                );
              })}
            </button>
          );
        })}
        {coins.map((c) => (
          <span
            key={c.id}
            aria-hidden="true"
            className="season-coin absolute"
            style={{ left: c.x - 8, bottom: c.y, "--dx": `${c.dx}px`, "--dy": `${c.dy}px`, "--spin": `${c.spin}deg` } as CSSProperties}
            onAnimationEnd={(event) => { if (event.target === event.currentTarget) setCoins((current) => current.filter((x) => x.id !== c.id)); }}
          >
            <PixelSprite sprite={COIN} scale={2.2} />
          </span>
        ))}
      </div>
    </>
  );
}
