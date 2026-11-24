"use client";

import { useRouter } from "next/navigation";
import { useState, type DragEvent, type ReactNode } from "react";
import { ArrowDown, ArrowUp, Check, GripVertical, RotateCcw, SlidersHorizontal } from "lucide-react";
import {
  DASHBOARD_COOKIE, DEFAULT_LAYOUT, moveWidget, serializeLayout, toggleWidget, visibleWidgets, WIDGET_INFO,
  type DashboardLayout, type WidgetId,
} from "@/lib/dashboard";

/** Saved for a year on this device; read by app/meetups/page.tsx on the server. */
function persistLayout(layout: DashboardLayout) {
  document.cookie = `${DASHBOARD_COOKIE}=${serializeLayout(layout)}; path=/; max-age=31536000; samesite=lax`;
}

/**
 * The feed's side widgets in the student's order (issue #46, ADR 0031). "Customize" lets them
 * drag widgets (or use the move buttons, which also work with a keyboard, screen reader or touch),
 * hide them, and hide the photo carousel. The layout is saved in a cookie so the server renders
 * it from the first paint. Widgets that were hidden aren't rendered on the server, so showing one
 * again (or toggling the carousel) refreshes the page to fetch it.
 */
export function DashboardWidgets({ initial, slots }: { initial: DashboardLayout; slots: Partial<Record<WidgetId, ReactNode>> }) {
  const router = useRouter();
  const [layout, setLayout] = useState(initial);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<WidgetId | null>(null);
  const [message, setMessage] = useState("");

  function save(next: DashboardLayout, note: string) {
    setLayout(next);
    setMessage(note);
    persistLayout(next);
    const missing = visibleWidgets(next).some((id) => !slots[id]);
    if (missing || next.hero !== layout.hero) router.refresh();
  }

  const position = (id: WidgetId) => layout.order.indexOf(id);
  const move = (id: WidgetId, to: number) => {
    if (to < 0 || to >= layout.order.length || to === position(id)) return;
    save(moveWidget(layout, id, to), `${WIDGET_INFO[id].label} moved to position ${to + 1} of ${layout.order.length}.`);
  };

  // HTML drag and drop (mouse); the move buttons cover keyboard, screen readers and touch.
  const dragProps = (id: WidgetId) => editing ? {
    draggable: true,
    onDragStart: (e: DragEvent) => { setDragging(id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", id); },
    onDragOver: (e: DragEvent) => { if (dragging) { e.preventDefault(); e.dataTransfer.dropEffect = "move"; } },
    onDrop: (e: DragEvent) => { e.preventDefault(); if (dragging && dragging !== id) move(dragging, position(id)); setDragging(null); },
    onDragEnd: () => setDragging(null),
  } : {};

  const visible = visibleWidgets(layout);
  const btn = "inline-flex size-9 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-muted hover:text-ink disabled:opacity-30 focus-visible:outline-2 focus-visible:outline-focus";

  return (
    <div>
      <div className="mb-3 flex justify-end">
        <button
          type="button" aria-expanded={editing} aria-controls="dashboard-editor" onClick={() => setEditing((v) => !v)}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-soft hover:border-brand focus-visible:outline-2 focus-visible:outline-focus"
        >
          {editing ? <Check aria-hidden="true" size={16} /> : <SlidersHorizontal aria-hidden="true" size={16} />}
          {editing ? "Done" : "Customize"}
        </button>
      </div>

      {editing && (
        <div id="dashboard-editor" className="mb-6 rounded-2xl border border-brand-line bg-brand-soft p-4">
          <h2 className="text-sm font-bold text-ink">Customize your feed</h2>
          <p className="mt-0.5 text-xs text-ink-muted">Drag widgets, or use the arrows. Saved on this device.</p>
          <label className="mt-3 flex min-h-11 items-center gap-2.5 rounded-xl bg-surface px-3 text-sm font-semibold text-ink-soft">
            <input type="checkbox" checked={layout.hero} onChange={() => save({ ...layout, hero: !layout.hero }, layout.hero ? "Photo carousel hidden." : "Photo carousel shown.")} className="size-4 accent-[var(--m-brand)]" />
            Photo carousel at the top
          </label>
          <ul aria-label="Widgets" className="mt-2 space-y-1.5">
            {layout.order.map((id, index) => {
              const shown = !layout.hidden.includes(id);
              return (
                <li key={id} {...dragProps(id)} className={`flex items-center gap-2 rounded-xl bg-surface p-1.5 pl-2 ${dragging === id ? "opacity-50" : ""} ${editing ? "cursor-grab" : ""}`}>
                  <GripVertical aria-hidden="true" size={16} className="shrink-0 text-ink-subtle" />
                  <label className="flex min-w-0 flex-1 items-center gap-2.5">
                    <input type="checkbox" checked={shown} onChange={() => save(toggleWidget(layout, id), `${WIDGET_INFO[id].label} ${shown ? "hidden" : "shown"}.`)} className="size-4 shrink-0 accent-[var(--m-brand)]" />
                    <span className="min-w-0 flex-1">
                      <span className={`block text-sm font-semibold ${shown ? "text-ink" : "text-ink-muted line-through"}`}>{WIDGET_INFO[id].label}</span>
                      <span className="line-clamp-1 text-xs text-ink-muted">{WIDGET_INFO[id].description}</span>
                    </span>
                  </label>
                  <button type="button" className={btn} disabled={index === 0} onClick={() => move(id, index - 1)} aria-label={`Move ${WIDGET_INFO[id].label} up`}><ArrowUp aria-hidden="true" size={16} /></button>
                  <button type="button" className={btn} disabled={index === layout.order.length - 1} onClick={() => move(id, index + 1)} aria-label={`Move ${WIDGET_INFO[id].label} down`}><ArrowDown aria-hidden="true" size={16} /></button>
                </li>
              );
            })}
          </ul>
          <button type="button" onClick={() => save({ ...DEFAULT_LAYOUT, order: [...DEFAULT_LAYOUT.order] }, "Layout reset.")} className="mt-3 inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-3 text-sm font-semibold text-ink-soft hover:border-brand focus-visible:outline-2 focus-visible:outline-focus">
            <RotateCcw aria-hidden="true" size={15} /> Reset layout
          </button>
        </div>
      )}

      <div className="space-y-6">
        {visible.map((id) => slots[id] ? (
          // While customizing, widgets can be dragged directly; their own links and buttons are paused.
          <div
            key={id} {...dragProps(id)}
            className={`[&>*]:mt-0! ${editing ? "cursor-grab rounded-2xl outline-2 outline-offset-4 outline-dashed outline-brand-line [&>*]:pointer-events-none" : ""} ${dragging === id ? "opacity-50" : ""}`}
          >
            {slots[id]}
          </div>
        ) : null)}
        {visible.length === 0 && <p className="text-sm text-ink-muted">All widgets are hidden. Use Customize to bring them back.</p>}
      </div>
      <p role="status" className="sr-only">{message}</p>
    </div>
  );
}
