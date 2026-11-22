"use client";

import dynamic from "next/dynamic";

// The game is canvas-only; load it in the browser, on this page only.
export const MartletFlightLoader = dynamic(() => import("./MartletFlight"), {
  ssr: false,
  loading: () => <div className="mx-auto grid aspect-[360/600] w-full max-w-[420px] place-items-center rounded-3xl bg-surface-muted"><p role="status" className="text-sm text-ink-muted">Warming up…</p></div>,
});
