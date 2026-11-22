"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { heroPhotoLicense, heroSlides } from "./hero-slides";

const ROTATION_MS = 6000;
const motionPreference = "(prefers-reduced-motion: reduce)";
const controlClass = "inline-grid min-h-11 min-w-11 place-items-center rounded-lg text-white hover:bg-surface/10 focus-visible:outline-2 focus-visible:outline-white disabled:opacity-50";
const photoSizes = "(min-width: 1152px) 726px, (min-width: 768px) 64vw, calc(100vw - 32px)";

function subscribeToMotionPreference(onChange: () => void) {
  const query = window.matchMedia(motionPreference);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

export function HeroCarousel() {
  const [selection, setSelection] = useState({ current: 0, previous: -1 });
  const [imageReady, setImageReady] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const reducedMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    () => window.matchMedia(motionPreference).matches,
    () => true,
  );

  const { current, previous } = selection;
  const next = (current + 1) % heroSlides.length;
  const slide = heroSlides[current];
  const rotating = !hovered && !focused && !reducedMotion;

  useEffect(() => {
    if (!rotating) return;
    const timer = window.setTimeout(() => setSelection({ current: next, previous: current }), ROTATION_MS);
    return () => window.clearTimeout(timer);
  }, [rotating, selection, current, next]);

  function navigate(index: number) {
    setSelection({
      current: (index + heroSlides.length) % heroSlides.length,
      previous: index === current ? previous : current,
    });
  }

  return (
    <section
      aria-label="Explore McGill Martlet"
      aria-roledescription="carousel"
      className="relative isolate overflow-hidden rounded-3xl bg-stone-900 text-white"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setFocused(false);
      }}
      onKeyDown={(event) => {
        if (event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
        event.preventDefault();
        navigate(current + (event.key === "ArrowRight" ? 1 : -1));
      }}
    >
      <h1 className="sr-only">McGill Martlet</h1>
      <div className="relative h-52 bg-stone-800 sm:h-60 md:absolute md:inset-y-0 md:right-0 md:h-auto md:w-2/3">
        {heroSlides.map((item, index) => {
          const active = index === current;
          const first = index === 0 && previous === -1;
          if (!active && index !== previous && !(imageReady && !reducedMotion && index === next)) return null;

          return (
            <div
              key={item.title}
              aria-hidden={!active}
              className={`absolute inset-0 bg-stone-800 transition-opacity duration-700 motion-reduce:transition-none ${active ? (first ? "z-10 opacity-100" : "z-10 opacity-100 motion-safe:starting:opacity-0") : "opacity-0"}`}
            >
              <Image
                src={item.image}
                alt={item.alt}
                fill
                preload={first}
                loading={first ? undefined : "eager"}
                fetchPriority={first ? undefined : active ? "auto" : "low"}
                sizes={photoSizes}
                className={`object-cover ${item.position}`}
                onLoad={active ? () => setImageReady(true) : undefined}
                onError={active ? () => setImageReady(true) : undefined}
              />
            </div>
          );
        })}
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 z-20 hidden bg-gradient-to-r from-stone-900 via-stone-900/75 via-28% to-transparent to-60% md:block" />
        <a
          href={slide.source}
          className="absolute right-2 bottom-2 z-30 rounded-md bg-stone-950/80 px-2 py-1 text-xs text-white hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
        >
          Photo by {slide.photographer} · {heroPhotoLicense}
        </a>
      </div>

      <div className="relative z-20 px-5 pt-6 pb-4 md:w-[53%] md:px-8 md:pt-10 md:pb-6 lg:px-10 lg:pt-12">
        <div className="grid">
          {heroSlides.map((item, index) => (
            <div
              key={item.title}
              role="group"
              aria-roledescription="slide"
              aria-label={`${index + 1} of ${heroSlides.length}`}
              aria-hidden={index !== current}
              inert={index !== current}
              className={`col-start-1 row-start-1 flex flex-col items-start ${index === current ? "" : "invisible"}`}
            >
              <h2 className="text-4xl leading-tight font-extrabold tracking-tight lg:text-5xl">{item.title}</h2>
              <p className="mt-2 max-w-[35ch] text-base leading-6 text-stone-100 lg:text-lg lg:leading-7">{item.description}</p>
              <div className="mt-5 flex flex-wrap gap-2.5">
                {item.actions.map(({ label, href }, actionIndex) => (
                  <Link key={href} href={href} prefetch={index === current ? undefined : false} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${actionIndex === 0 ? "bg-brand hover:bg-brand-hover" : "border border-white/50 bg-stone-950/60 hover:bg-stone-950"}`}>
                    {label} <ArrowUpRight aria-hidden="true" size={16} />
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div role="group" aria-label="Carousel controls" className="mt-3 flex w-fit flex-wrap items-center gap-0.5">
          <button type="button" aria-label="Previous slide" className={controlClass} onClick={() => navigate(current - 1)}>
            <ChevronLeft aria-hidden="true" size={20} />
          </button>
          {heroSlides.map((item, index) => (
            <button
              key={item.title}
              type="button"
              aria-label={`Slide ${index + 1}: ${item.title}`}
              aria-current={index === current ? "true" : undefined}
              className="inline-grid h-11 w-9 place-items-center rounded-lg hover:bg-surface/10 focus-visible:outline-2 focus-visible:outline-white"
              onClick={() => navigate(index)}
            >
              <span aria-hidden="true" className={`h-1.5 rounded-full ${index === current ? "w-6 bg-red-400" : "w-2 bg-stone-300/75"}`} />
            </button>
          ))}
          <button type="button" aria-label="Next slide" className={controlClass} onClick={() => navigate(current + 1)}>
            <ChevronRight aria-hidden="true" size={20} />
          </button>
        </div>
        <p aria-live={rotating ? "off" : "polite"} aria-atomic="true" className="sr-only">
          Slide {current + 1} of {heroSlides.length}. {slide.title}
        </p>
      </div>
    </section>
  );
}