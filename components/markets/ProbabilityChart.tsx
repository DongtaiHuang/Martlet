"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import type { HistoryPoint } from "@/lib/markets";

const HEIGHT = 220;
const PAD = { top: 14, right: 52, bottom: 28, left: 40 };
const TICKS = [0, 0.25, 0.5, 0.75, 1];

const pct = (p: number) => `${Math.round(p * 100)}%`;
const when = (t: number, withTime = true) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montreal", month: "short", day: "numeric", ...(withTime ? { hour: "numeric", minute: "2-digit" } : {}),
}).format(t);

/**
 * YES probability over time (issue #139). One series, so no legend: the heading names it.
 * A step line, since the price only changes at trades. Hover or focus it and use the arrow keys
 * to read each point; the same data is in a table below.
 */
export function ProbabilityChart({ history, now, label }: { history: HistoryPoint[]; now: number; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(200, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (history.length === 0) return <p className="text-sm text-ink-muted">No trades yet.</p>;

  const t0 = history[0].t;
  const t1 = Math.max(now, history[history.length - 1].t, t0 + 60_000);
  const plotW = width - PAD.left - PAD.right, plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / (t1 - t0)) * plotW;
  const y = (p: number) => PAD.top + (1 - p) * plotH;

  // Step-after: hold each price until the next trade, then carry the last one to now.
  let d = `M${x(history[0].t)},${y(history[0].p)}`;
  for (let i = 1; i < history.length; i++) d += `H${x(history[i].t)}V${y(history[i].p)}`;
  d += `H${x(t1)}`;
  const last = history[history.length - 1];

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const t = t0 + ((clientX - rect.left - PAD.left) / plotW) * (t1 - t0);
    // The point in effect at time t (the latest trade at or before it).
    let i = 0;
    while (i + 1 < history.length && history[i + 1].t <= t) i++;
    setActive(i);
  };
  const onKey = (e: KeyboardEvent) => {
    const max = history.length - 1;
    const next = e.key === "ArrowLeft" ? (active ?? max + 1) - 1 : e.key === "ArrowRight" ? (active ?? -1) + 1 : e.key === "Home" ? 0 : e.key === "End" ? max : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.min(max, Math.max(0, next)));
  };

  const point = active === null ? null : history[active];
  const tipLeft = point ? Math.min(Math.max(x(point.t), PAD.left + 50), width - PAD.right - 10) : 0;

  return (
    <div>
      <div
        ref={box}
        tabIndex={0}
        role="group"
        aria-label={`${label}. Use the left and right arrow keys to step through the trades.`}
        onPointerMove={(e: PointerEvent) => pick(e.clientX)}
        onPointerLeave={() => setActive(null)}
        onKeyDown={onKey}
        onBlur={() => setActive(null)}
        className="relative touch-pan-y rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg width={width} height={HEIGHT} className="block max-w-full" aria-hidden="true">
          {TICKS.map((p) => (
            <g key={p}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(p)} y2={y(p)} stroke="var(--m-line)" strokeWidth={1} strokeDasharray={p === 0.5 ? "4 4" : undefined} />
              <text x={PAD.left - 8} y={y(p)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--m-ink-muted)">{pct(p)}</text>
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 8} fontSize={11} fill="var(--m-ink-muted)">{when(t0, false)}</text>
          <text x={width - PAD.right} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill="var(--m-ink-muted)">{now >= t1 ? "Now" : when(t1, false)}</text>
          <path d={d} fill="none" stroke="var(--m-brand-ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* Latest price: marker with a surface ring, and a direct label. */}
          <circle cx={x(t1)} cy={y(last.p)} r={4} fill="var(--m-brand-ink)" stroke="var(--m-surface)" strokeWidth={2} />
          <text x={x(t1) + 8} y={y(last.p)} dy="0.32em" fontSize={12} fontWeight={700} fill="var(--m-ink)">{pct(last.p)}</text>
          {point && (
            <g>
              <line x1={x(point.t)} x2={x(point.t)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--m-ink-subtle)" strokeWidth={1} />
              <circle cx={x(point.t)} cy={y(point.p)} r={5} fill="var(--m-brand-ink)" stroke="var(--m-surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {point && (
          <div
            className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md"
            style={{ left: tipLeft }}
          >
            <span className="block font-bold text-ink">{pct(point.p)} yes</span>
            <span className="block text-ink-muted">{active === 0 ? "Opened · " : ""}{when(point.t)}</span>
          </div>
        )}
      </div>
      <p aria-live="polite" className="sr-only">{point ? `${pct(point.p)} yes, ${when(point.t)}${active === 0 ? ", when the market opened" : ""}` : ""}</p>
      <details className="mt-2 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-ink">Show as a table</summary>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{label}, one row per trade</caption>
            <thead className="sticky top-0 bg-surface-muted text-ink-2">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Time</th><th scope="col" className="px-3 py-2 text-right font-semibold">Chance of yes</th></tr>
            </thead>
            <tbody>
              {[...history].reverse().map((pt, i) => (
                <tr key={`${pt.t}-${i}`} className="border-t border-line">
                  <td className="px-3 py-1.5 text-ink-2">{when(pt.t)}{i === history.length - 1 ? " (opened)" : ""}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{pct(pt.p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
