"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type MouseEvent, type PointerEvent } from "react";
import { MCGILL_FACTS } from "@/lib/mcgill-facts";
import { MARTY_TIPS } from "@/lib/marty-tips";
import { FlyingMartletSprite } from "./FlyingMartletSprite";
import { MartletNest, MartletZzz } from "./MartletNest";
import { martletHopGroup, type HopDirection } from "./martlet-hops";

/** A random line from `list`, never the same as `previous` twice in a row. */
function pickFrom(list: readonly string[], previous?: string): string {
  const options = list.filter((line) => line !== previous);
  return options[Math.floor(Math.random() * options.length)];
}

/** Keep a bubble on screen near the edges: align it to Marty's side instead of centring. */
function edgeAlignment(element: Element | null) {
  if (!element) return "left-1/2 -translate-x-1/2";
  const bounds = element.getBoundingClientRect();
  const center = bounds.left + bounds.width / 2;
  return center < 124 ? "left-0" : center > window.innerWidth - 124 ? "right-0" : "left-1/2 -translate-x-1/2";
}

// Fun facts pop up on their own every 10–30 seconds and stay for a few seconds.
const CHATTER_MIN_MS = 10_000;
const CHATTER_MAX_MS = 30_000;
const CHATTER_SHOW_MS = 7_000; // matches the martlet-chatter animation in globals.css

type Point = { x: number; y: number };
type Drag = { id: number; start: Point; offset: Point | null };
const DRAG_THRESHOLD = 4;
const HOMING_MS = 700; // glide back down to the nest before falling asleep (matches globals.css)
// Drop zone around the nest: drop the bird anywhere this close (its centre, in px) to snap it in.
const NEST_REACH_X = 64;
const NEST_REACH_Y = 120;

/** "away": out and about; "homing": gliding down into the nest; "asleep": napping (zzz). */
type NestState = "away" | "homing" | "asleep";

/**
 * Marty, the martlet mascot: hops along the bottom of the screen, gives tips on using Martlet
 * when hovered, focused or tapped, says a McGill fun fact in a speech bubble every 10–30
 * seconds, can be dragged around, and naps in the nest at the bottom-left end of the lane.
 */
export function FlyingMartlet() {
  const [direction, setDirection] = useState<HopDirection>(1);
  const [atEdge, setAtEdge] = useState(false);
  const [nest, setNest] = useState<NestState>("away");
  const [overNest, setOverNest] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const dockInNest = useRef<(() => void) | null>(null);
  const docking = useRef(false);
  const [tooltip, setTooltip] = useState<{ tip: string; alignment: string; below: boolean } | null>(null);
  const [chatter, setChatter] = useState<{ fact: string; alignment: string } | null>(null);
  const previousTip = useRef<string>(undefined);
  const [position, setPosition] = useState<{ level: number; drag: Point | null }>({ level: 0, drag: null });
  const pointer = useRef<Drag | null>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const birdRef = useRef<HTMLButtonElement>(null);
  const hops = useRef<Animation[]>([]);
  const dropAlongLane = useRef<((offsetX: number) => void) | null>(null);
  const dragged = useRef(false);
  const tooltipId = useId();

  // Layout effect: when a drop on the nest also turns the bird around, the glide must start
  // in the same frame as the direction change.
  useLayoutEffect(() => {
    const trackElement = trackRef.current;
    const bodyElement = birdRef.current?.querySelector("svg");
    const laneElement = trackElement?.parentElement;
    if (!trackElement || !bodyElement || !laneElement) return;
    const track = trackElement;
    const body = bodyElement;
    const lane = laneElement;

    const motion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const limit = () => Math.max(0, lane.clientWidth - track.offsetWidth);
    let waiting = false;
    let settle: ReturnType<typeof setTimeout> | undefined;

    function stop() {
      hops.current.forEach((animation) => animation.cancel());
      hops.current = [];
    }

    function park(position: number) {
      track.style.transform = `translateX(${position}px)`;
      stop();
    }

    // Hold the bird where it is on screen (mid-hop included) as a plain transform.
    function freeze() {
      const x = lanePosition();
      track.style.transition = "";
      track.style.transform = `translateX(${x}px)`;
      stop();
    }

    // The left end of the lane is the nest. Glide there from wherever the bird is (and back
    // down to the lane's home height if it was dragged elsewhere), then nap until clicked.
    function dock() {
      waiting = true;
      clearTimeout(settle);
      freeze();
      if (!motion.matches) {
        void track.offsetWidth; // apply the frozen position before transitioning from it
        track.style.transition = `transform ${HOMING_MS}ms ease-in-out`;
      }
      track.style.transform = "translateX(0px)";
      setAtEdge(true);
      setPosition((current) => ({ level: 0, drag: current.drag }));
      setNest("homing");
      settle = setTimeout(() => {
        track.style.transition = "";
        if (!pointer.current) setNest("asleep");
      }, motion.matches ? 0 : HOMING_MS);
    }

    function run(position: number) {
      const edge = limit();
      const x = Math.max(0, Math.min(edge, position));
      const destination = direction === 1 ? edge : 0;
      if (motion.matches || edge === 0 || waiting) {
        park(waiting ? destination : x);
        return;
      }
      if (x === destination) {
        if (direction === -1) {
          dock();
          return;
        }
        waiting = true;
        park(x);
        setAtEdge(true);
        return;
      }

      const group = martletHopGroup(window.innerWidth, edge, x, direction);
      park(x);
      const options: KeyframeAnimationOptions = { duration: group.duration, fill: "both" };
      const animations = [track.animate(group.track, options), body.animate(group.body, options)];
      hops.current = animations;
      if (pointer.current) animations.forEach((animation) => animation.pause());
      void Promise.all(animations.map((animation) => animation.finished)).then(
        () => { if (hops.current === animations) run(group.position); },
        () => {}, // Viewport, motion preference, or direction changed.
      );
    }

    function lanePosition() {
      return track.getBoundingClientRect().left - lane.getBoundingClientRect().left;
    }

    function reframe() {
      run(lanePosition());
    }

    dropAlongLane.current = (offsetX) => {
      const x = Math.max(0, Math.min(limit(), lanePosition() + offsetX));
      // Start over from wherever it was dropped; run() decides whether that's an edge or the nest.
      waiting = false;
      clearTimeout(settle);
      track.style.transition = "";
      setAtEdge(false);
      setNest("away");
      run(x);
    };

    // Dropped on the nest: settle in, turning to face it first if needed.
    dockInNest.current = () => {
      if (direction === -1) {
        dock();
        return;
      }
      freeze();
      docking.current = true;
      setDirection(-1); // this effect re-runs and docks
    };

    if (docking.current) {
      docking.current = false;
      dock();
    } else {
      run(direction === 1 ? 0 : limit());
    }
    window.addEventListener("resize", reframe);
    motion.addEventListener("change", reframe);
    return () => {
      clearTimeout(settle);
      track.style.transition = "";
      dropAlongLane.current = null;
      dockInNest.current = null;
      window.removeEventListener("resize", reframe);
      motion.removeEventListener("change", reframe);
      stop();
    };
  }, [direction]);

  useEffect(() => {
    // Is the bird (its centre) close enough to the nest to drop into it?
    function nearNest(bird: DOMRect) {
      const nestElement = stageRef.current?.querySelector(".martlet-nest");
      if (!nestElement) return false;
      const nest = nestElement.getBoundingClientRect();
      const x = bird.left + bird.width / 2;
      const y = bird.top + bird.height / 2;
      return x <= nest.right + NEST_REACH_X && y >= nest.top - NEST_REACH_Y;
    }

    function move(event: globalThis.PointerEvent) {
      const held = pointer.current;
      if (!held || held.id !== event.pointerId) return;
      const x = event.clientX - held.start.x;
      const y = event.clientY - held.start.y;
      if (!dragged.current && Math.hypot(x, y) < DRAG_THRESHOLD) return;
      if (!dragged.current) {
        setTooltip(null);
        setNest("away"); // picked up: wake up and flap
      }
      dragged.current = true;
      const offset = { x, y };
      held.offset = offset;
      setPosition((current) => ({ ...current, drag: offset }));
      const body = birdRef.current?.querySelector("svg");
      if (body) setOverNest(nearNest(body.getBoundingClientRect()));
    }

    function finish(drop: boolean) {
      const held = pointer.current;
      if (!held) return;
      pointer.current = null;
      setOverNest(false);
      const button = birdRef.current;
      const body = button?.querySelector("svg");
      if (drop && held.offset && body && dockInNest.current && nearNest(body.getBoundingClientRect())) {
        // Glide from the drop point into the nest (the lane eases back to its home height).
        setNest("homing");
        setPosition({ level: 0, drag: null });
        dockInNest.current();
        return;
      }
      if (drop && held.offset && button && body) {
        const bird = body.getBoundingClientRect();
        const trackTop = button.getBoundingClientRect().top;
        const top = Math.max(8, Math.min(window.innerHeight - bird.height - 8, bird.top));
        const deltaY = held.offset.y + top - trackTop;
        // Set the new height first, so landing on the nest (which resets it) wins.
        setPosition((current) => ({ level: current.level + deltaY, drag: null }));
        dropAlongLane.current?.(held.offset.x);
        return;
      }
      setPosition((current) => ({ ...current, drag: null }));
      hops.current.forEach((animation) => {
        if (animation.playState === "paused") animation.play();
      });
    }

    function release(event: globalThis.PointerEvent) {
      if (pointer.current?.id === event.pointerId) finish(event.type === "pointerup");
    }

    const reset = () => finish(false);

    // Track the pointer across the viewport, even when it moves outside the sprite between frames.
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", release);
    window.addEventListener("pointercancel", release);
    window.addEventListener("blur", reset);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", release);
      window.removeEventListener("pointercancel", release);
      window.removeEventListener("blur", reset);
    };
  }, []);

  function grab(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || pointer.current) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    pointer.current = { id: event.pointerId, start: { x: event.clientX, y: event.clientY }, offset: null };
    dragged.current = false;
    hops.current.forEach((animation) => animation.pause());
  }

  function turn(event: MouseEvent<HTMLButtonElement>) {
    if (event.detail > 0 && dragged.current) return;
    // Away from the edges a tap or click asks for (another) tip; touch has no hover.
    if (!atEdge) {
      showTip(event.currentTarget);
      return;
    }
    setAtEdge(false);
    setNest("away");
    setDirection((heading) => heading === 1 ? -1 : 1);
  }

  function showTip(button: HTMLElement) {
    const tip = pickFrom(MARTY_TIPS, previousTip.current);
    previousTip.current = tip;
    setTooltip({ tip, alignment: edgeAlignment(button), below: button.getBoundingClientRect().top < 120 });
  }

  // Every 10–30 seconds Marty says a fun fact in a speech bubble (skipped while the tab is
  // hidden). The bubble is decorative: it isn't announced, so screen readers aren't
  // interrupted every few seconds; the tips on focus are the accessible part.
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    let previous: string | undefined;
    function wait() {
      timer = setTimeout(speak, CHATTER_MIN_MS + Math.random() * (CHATTER_MAX_MS - CHATTER_MIN_MS));
    }
    function speak() {
      if (document.visibilityState !== "visible") return wait();
      const fact = pickFrom(MCGILL_FACTS, previous);
      previous = fact;
      setChatter({ fact, alignment: edgeAlignment(birdRef.current) });
      timer = setTimeout(() => {
        setChatter(null);
        wait();
      }, CHATTER_SHOW_MS);
    }
    wait();
    return () => clearTimeout(timer);
  }, []);

  const visibleTip = position.drag ? null : tooltip;
  const asleep = nest === "asleep";
  // Marty doesn't chat while showing a tip, being dragged, or napping.
  const visibleChatter = visibleTip || position.drag || nest !== "away" ? null : chatter;
  const tail = (alignment: string) => alignment === "left-0" ? "left-8" : alignment === "right-0" ? "right-8" : "left-1/2 -translate-x-1/2";

  return (
    <div ref={stageRef} className="martlet-stage pointer-events-none fixed inset-0 z-40 overflow-hidden" data-nest={nest} data-over-nest={overNest}>
      <MartletNest layer="back" />
      <div
        className="martlet-drag-offset martlet-lane absolute bottom-8 pt-4 pb-3"
        data-dragging={position.drag !== null}
        style={{ transform: `translate(${position.drag?.x ?? 0}px, ${position.level + (position.drag?.y ?? 0)}px)` }}
      >
        <div
          ref={trackRef}
          data-direction={direction === 1 ? "right" : "left"}
          className="relative w-max"
        >
          {visibleChatter && (
            <span
              key={visibleChatter.fact}
              aria-hidden="true"
              className={`martlet-chatter absolute bottom-full mb-3 w-max max-w-[min(15rem,calc(100vw-2rem))] rounded-2xl border-2 border-brand-line bg-surface px-3 py-2 text-sm text-ink shadow-lg ${visibleChatter.alignment}`}
            >
              <span className="block text-[0.7rem] font-bold tracking-wide text-brand-ink uppercase">Fun fact</span>
              <span className="italic">“{visibleChatter.fact}”</span>
              {/* Speech-bubble tail pointing down at Marty. */}
              <span className={`absolute -bottom-[7px] size-3 rotate-45 border-r-2 border-b-2 border-brand-line bg-surface ${tail(visibleChatter.alignment)}`} />
            </span>
          )}
          {visibleTip && (
            <span id={tooltipId} role="tooltip" className={`absolute w-max max-w-[min(15rem,calc(100vw-1rem))] rounded-xl border border-brand-line bg-surface px-3 py-2 text-sm text-ink shadow-lg ${visibleTip.below ? "top-full mt-2" : "bottom-full mb-2"} ${visibleTip.alignment}`}>
              <span className="block text-xs font-bold text-brand-ink">Marty’s tip</span>
              {visibleTip.tip}
              {atEdge && <span className="mt-1 block text-xs text-ink-muted">{asleep ? "Shh, Marty's napping. Click to wake Marty up." : "Click to turn Marty around"}</span>}
            </span>
          )}
          <button
            ref={birdRef}
            type="button"
            aria-label={asleep ? "Marty is asleep in the nest. Wake Marty up" : atEdge ? "Marty, turn around" : "Marty the martlet"}
            aria-describedby={visibleTip ? tooltipId : undefined}
            className={`pointer-events-auto block touch-none select-none rounded-lg focus-visible:outline-2 focus-visible:outline-focus active:cursor-grabbing ${atEdge ? "cursor-pointer" : "cursor-grab"}`}
            onPointerDown={grab}
            onPointerEnter={(event) => { if (event.pointerType !== "touch") showTip(event.currentTarget); }}
            onPointerLeave={() => setTooltip(null)}
            onFocus={(event) => { if (event.currentTarget.matches(":focus-visible")) showTip(event.currentTarget); }}
            onBlur={() => setTooltip(null)}
            onClick={turn}
          >
            <FlyingMartletSprite />
          </button>
          {asleep && <MartletZzz />}
        </div>
      </div>
      <MartletNest layer="front" />
    </div>
  );
}
