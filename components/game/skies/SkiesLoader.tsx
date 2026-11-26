"use client";

import dynamic from "next/dynamic";

// MapLibre only runs in the browser; load the game on this page only.
export const SkiesLoader = dynamic(() => import("./MartletSkies"), {
  ssr: false,
  loading: () => <div className="grid aspect-[4/5] w-full place-items-center rounded-3xl bg-surface-muted sm:aspect-[16/10]"><p role="status" className="text-sm text-ink-muted">Stretching wings…</p></div>,
});
