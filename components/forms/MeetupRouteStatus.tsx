import Link from "next/link";
import { MartletNavLinks } from "@/components/layout/MartletNavLinks";

export function MeetupRouteStatus({ title, description, loading, retry }: { title: string; description?: string; loading?: boolean; retry?: () => void }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Client-side error boundaries cannot import the server-only authentication navbar. */}
      <header className="border-b border-line bg-surface text-ink-soft">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 pt-3 sm:flex-row sm:items-center sm:justify-between sm:px-8 sm:py-3">
          <Link href="/meetups" className="inline-flex min-h-11 items-center text-lg font-extrabold tracking-tight text-brand-ink">McGill Martlet</Link>
          <MartletNavLinks />
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-8 sm:py-12">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm sm:p-8">
          <div role={loading ? "status" : undefined}>
            <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
            {description && <p className="mt-2 text-ink-muted">{description}</p>}
          </div>
          {loading ? (
            <div aria-hidden="true" className="mt-5 space-y-3 motion-safe:animate-pulse">
              <div className="h-5 w-2/3 rounded bg-line" />
              <div className="h-4 w-1/2 rounded bg-surface-muted" />
              <div className="h-4 w-4/5 rounded bg-surface-muted" />
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-4">
              {retry && <button type="button" onClick={retry} className="min-h-11 rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus">Try again</button>}
              <Link href="/meetups" className="inline-flex min-h-11 items-center text-sm font-bold text-brand-ink hover:underline">Back to feed</Link>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
