"use client";

import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Cards per page in the Meetups tab (meetups and landmarks views). */
export const PAGE_SIZE = 8; // four rows of two on laptops, level with the widgets

/**
 * Client-side paging over an already-loaded list. `listTop` goes on the element above the
 * list: changing page scrolls it back into view, so the new page starts at its first card.
 */
export function usePagination<T>(items: readonly T[], pageSize = PAGE_SIZE) {
  const [page, setPage] = useState(0);
  const top = useRef<HTMLElement | null>(null);
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  // Clamp in case the list got shorter (e.g. a meetup started) while on a later page.
  const currentPage = Math.min(page, pageCount - 1);
  const pageItems = items.slice(currentPage * pageSize, (currentPage + 1) * pageSize);

  function goToPage(next: number) {
    setPage(next);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    top.current?.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" });
  }

  return {
    page: currentPage,
    pageCount,
    pageItems,
    firstShown: currentPage * pageSize + 1,
    lastShown: currentPage * pageSize + pageItems.length,
    goToPage,
    /** Back to page 1 without scrolling, e.g. when a filter changes. */
    resetPage: () => setPage(0),
    /** Callback ref (works on any element type) for the element above the list. */
    listTop: (element: HTMLElement | null) => { top.current = element; },
  };
}

/** Page indexes to show as buttons: first, last, and the current page ±1. Longer gaps become null ("…"). */
function visiblePages(page: number, pageCount: number): (number | null)[] {
  const shown = [...new Set([0, page - 1, page, page + 1, pageCount - 1])]
    .filter((index) => index >= 0 && index < pageCount)
    .sort((a, b) => a - b);
  return shown.flatMap((index, i) => {
    const gap = i > 0 ? index - shown[i - 1] - 1 : 0;
    // Show a single missing page as its number; only longer gaps become "…".
    return gap === 0 ? [index] : gap === 1 ? [index - 1, index] : [null, index];
  });
}

/** Previous / page numbers / Next. Renders nothing when everything fits on one page. */
export function Pagination({ page, pageCount, onChange, label }: {
  page: number;
  pageCount: number;
  onChange: (page: number) => void;
  /** Accessible name for the navigation, e.g. "Meetup pages". */
  label: string;
}) {
  if (pageCount <= 1) return null;
  const button = "inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-xl border px-3 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:cursor-not-allowed disabled:opacity-40";
  const idle = "border-line bg-surface text-ink-2 hover:border-brand-line hover:text-brand-ink-strong";

  return (
    <nav aria-label={label} className="mt-6 flex flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={() => onChange(page - 1)} disabled={page === 0} className={`${button} ${idle}`}>
        <ChevronLeft aria-hidden="true" size={18} /> Previous
      </button>
      {/* Numbered pages on wider screens; phones get "Page 2 of 4" so the row never wraps awkwardly. */}
      <ol className="hidden items-center gap-2 sm:flex">
        {visiblePages(page, pageCount).map((index, i) => index === null ? (
          <li key={`gap-${i}`} aria-hidden="true" className="px-1 text-ink-muted">…</li>
        ) : (
          <li key={index}>
            <button
              type="button" onClick={() => onChange(index)} aria-current={index === page ? "page" : undefined}
              aria-label={`Page ${index + 1}`}
              className={`${button} ${index === page ? "border-brand bg-brand text-on-brand" : idle}`}
            >
              {index + 1}
            </button>
          </li>
        ))}
      </ol>
      <span className="px-1 text-sm font-medium text-ink-muted sm:hidden">Page {page + 1} of {pageCount}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page === pageCount - 1} className={`${button} ${idle}`}>
        Next <ChevronRight aria-hidden="true" size={18} />
      </button>
    </nav>
  );
}
