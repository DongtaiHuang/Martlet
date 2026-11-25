"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatPrice } from "@/lib/martlet-coin-types";

const HEIGHT = 240;
const PAD = { top: 14, right: 60, bottom: 28, left: 52 };

const when = (t: number, range: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Montreal",
  ...(range === "7d" ? { weekday: "short", hour: "numeric" } : { hour: "numeric", minute: "2-digit" }),
}).format(t);

/** Round-number gridlines covering [min, max]: about four steps of 1, 2, 2.5 or 5 × 10^n. */
function ticks(min: number, max: number): number[] {
  const span = Math.max(max - min, Math.abs(max) * 0.002, 0.0001);
  const raw = span / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const start = Math.floor(min / step) * step, end = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = start; v <= end + step / 2; v += step) out.push(Number(v.toFixed(8)));
  return out;
}

/**
 * Martlet Coin price over time (issue #148). One series, so no legend: the heading names it.
 * Hover, or focus and use the arrow keys, to read a point; the same data is in a table below.
 */
export function PriceChart({ points, range, label }: { points: { t: number; p: number }[]; range: string; label: string }) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [active, setActive] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(220, Math.round(entry.contentRect.width))));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (points.length < 2) return <p className="text-sm text-ink-muted">Not enough price history yet.</p>;

  const prices = points.map((pt) => pt.p);
  const yTicks = ticks(Math.min(...prices), Math.max(...prices));
  const lo = yTicks[0], hi = yTicks[yTicks.length - 1];
  // Gridline labels use as many decimals as the step needs (0.5 → 1, 0.25 → 2).
  const tickDecimals = Math.min(4, String(Number((yTicks[1] - yTicks[0]).toFixed(8))).split(".")[1]?.length ?? 0);
  const t0 = points[0].t, t1 = points[points.length - 1].t;
  const plotW = width - PAD.left - PAD.right, plotH = HEIGHT - PAD.top - PAD.bottom;
  const x = (t: number) => PAD.left + ((t - t0) / Math.max(1, t1 - t0)) * plotW;
  const y = (p: number) => PAD.top + (1 - (p - lo) / Math.max(1e-9, hi - lo)) * plotH;
  const d = points.map((pt, i) => `${i ? "L" : "M"}${x(pt.t).toFixed(1)},${y(pt.p).toFixed(1)}`).join("");
  const area = `${d}L${x(t1).toFixed(1)},${PAD.top + plotH}L${x(t0).toFixed(1)},${PAD.top + plotH}Z`;
  const last = points[points.length - 1];

  const pick = (clientX: number) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const t = t0 + ((clientX - rect.left - PAD.left) / plotW) * (t1 - t0);
    let best = 0;
    for (let i = 1; i < points.length; i++) if (Math.abs(points[i].t - t) < Math.abs(points[best].t - t)) best = i;
    setActive(best);
  };
  const onKey = (e: KeyboardEvent) => {
    const max = points.length - 1;
    const jump = e.shiftKey ? 10 : 1;
    const next = e.key === "ArrowLeft" ? (active ?? max + 1) - jump : e.key === "ArrowRight" ? (active ?? -1) + jump : e.key === "Home" ? 0 : e.key === "End" ? max : null;
    if (next === null) return;
    e.preventDefault();
    setActive(Math.min(max, Math.max(0, next)));
  };
  const point = active === null ? null : points[active];
  const tipLeft = point ? Math.min(Math.max(x(point.t), PAD.left + 50), width - PAD.right - 10) : 0;

  return (
    <div>
      <div
        ref={box} tabIndex={0} role="group"
        aria-label={`${label}. Use the left and right arrow keys to read prices; hold Shift to jump.`}
        onPointerMove={(e: PointerEvent) => pick(e.clientX)} onPointerLeave={() => setActive(null)}
        onKeyDown={onKey} onBlur={() => setActive(null)}
        className="relative touch-pan-y rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <svg width={width} height={HEIGHT} className="block max-w-full" aria-hidden="true">
          {yTicks.map((v) => (
            <g key={v}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(v)} y2={y(v)} stroke="var(--m-line)" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(v)} dy="0.32em" textAnchor="end" fontSize={11} fill="var(--m-ink-muted)">{v.toFixed(tickDecimals)}</text>
            </g>
          ))}
          <text x={PAD.left} y={HEIGHT - 8} fontSize={11} fill="var(--m-ink-muted)">{when(t0, range)}</text>
          <text x={width - PAD.right} y={HEIGHT - 8} textAnchor="end" fontSize={11} fill="var(--m-ink-muted)">Now</text>
          <path d={area} fill="var(--m-brand-ink)" opacity={0.08} />
          <path d={d} fill="none" stroke="var(--m-brand-ink)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(last.t)} cy={y(last.p)} r={4} fill="var(--m-brand-ink)" stroke="var(--m-surface)" strokeWidth={2} />
          <text x={x(last.t) + 8} y={y(last.p)} dy="0.32em" fontSize={12} fontWeight={700} fill="var(--m-ink)">{formatPrice(last.p)}</text>
          {point && (
            <g>
              <line x1={x(point.t)} x2={x(point.t)} y1={PAD.top} y2={PAD.top + plotH} stroke="var(--m-ink-subtle)" strokeWidth={1} />
              <circle cx={x(point.t)} cy={y(point.p)} r={5} fill="var(--m-brand-ink)" stroke="var(--m-surface)" strokeWidth={2} />
            </g>
          )}
        </svg>
        {point && (
          <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-xs shadow-md" style={{ left: tipLeft }}>
            <span className="block font-bold tabular-nums text-ink">{formatPrice(point.p)} points</span>
            <span className="block text-ink-muted">{when(point.t, "1h")}{range === "7d" ? `, ${when(point.t, "7d")}` : ""}</span>
          </div>
        )}
      </div>
      <p aria-live="polite" className="sr-only">{point ? `${formatPrice(point.p)} points at ${when(point.t, range)}` : ""}</p>
      <details className="mt-2 text-sm">
        <summary className="inline-flex min-h-11 cursor-pointer items-center font-semibold text-brand-ink">Show as a table</summary>
        <div className="max-h-64 overflow-y-auto rounded-xl border border-line">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">{label}</caption>
            <thead className="sticky top-0 bg-surface-muted text-ink-2">
              <tr><th scope="col" className="px-3 py-2 font-semibold">Time</th><th scope="col" className="px-3 py-2 text-right font-semibold">Price (points)</th></tr>
            </thead>
            <tbody>
              {[...points].reverse().map((pt) => (
                <tr key={pt.t} className="border-t border-line">
                  <td className="px-3 py-1.5 text-ink-2">{when(pt.t, range)}</td>
                  <td className="px-3 py-1.5 text-right font-semibold tabular-nums text-ink">{formatPrice(pt.p)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
