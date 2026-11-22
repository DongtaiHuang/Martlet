import type { Metadata } from "next";
import Link from "next/link";
import type { ComponentType } from "react";
import { BellRing, CalendarPlus, CheckCheck, Heart, LogIn, CalendarClock } from "lucide-react";
import { MartletNav } from "@/components/layout/MartletNav";
import { markAllRead } from "@/components/notifications/actions";
import { listNotifications } from "@/lib/notifications";
import { getCurrentUser } from "@/lib/supabase/auth";
import { getDataMode } from "@/lib/supabase/env";
import type { AppNotification, NotificationKind } from "@/types/notification";

export const metadata: Metadata = { title: "Notifications · McGill Martlet" };
export const dynamic = "force-dynamic";

// Color coding (ADR 0021): each kind gets its own chip and edge color so a
// glance separates new meetups, reminders and trend likes.
const KIND_META: Record<NotificationKind, {
  label: string;
  icon: ComponentType<{ size?: number; "aria-hidden"?: boolean; className?: string }>;
  chip: string;
  edge: string;
}> = {
  meetup_new: { label: "New meetup", icon: CalendarPlus, chip: "bg-sky-100 text-sky-950 ring-1 ring-sky-200", edge: "border-l-sky-400" },
  meetup_reminder: { label: "Reminder", icon: BellRing, chip: "bg-amber-100 text-amber-950 ring-1 ring-amber-200", edge: "border-l-amber-400" },
  meetup_updated: { label: "Meetup updated", icon: CalendarClock, chip: "bg-emerald-100 text-emerald-950 ring-1 ring-emerald-200 dark:bg-emerald-400/15 dark:text-emerald-200 dark:ring-emerald-800", edge: "border-l-emerald-400" },
  trend_like: { label: "Trend like", icon: Heart, chip: "bg-violet-100 text-violet-950 ring-1 ring-violet-200", edge: "border-l-violet-400" },
};

function timeAgo(iso: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(iso)) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function NotificationRow({ notification }: { notification: AppNotification }) {
  const meta = KIND_META[notification.kind];
  const Icon = meta.icon;
  const unread = notification.readAt === null;
  return (
    <li className={`border-l-4 ${meta.edge} ${unread ? "bg-surface" : "bg-surface/60"}`}>
      <Link
        href={notification.href || "/meetups"}
        className="flex items-start gap-3 px-4 py-3.5 hover:bg-canvas focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus"
      >
        <span aria-hidden="true" className={`mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full ${meta.chip} ${unread ? "" : "opacity-70"}`}>
          <Icon size={16} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className={`text-sm ${unread ? "font-bold" : "font-medium"} text-ink-soft [overflow-wrap:anywhere]`}>{notification.title}</span>
            {unread && <span className="size-2 shrink-0 self-center rounded-full bg-brand" aria-hidden="true" />}
          </span>
          {notification.body && <span className="mt-0.5 block text-sm text-ink-muted [overflow-wrap:anywhere]">{notification.body}</span>}
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${meta.chip}`}>{meta.label}</span>
            <span className="text-[11px] text-ink-subtle">{timeAgo(notification.createdAt)}</span>
          </span>
        </span>
      </Link>
    </li>
  );
}

export default async function NotificationsPage() {
  const live = getDataMode() === "live";
  const viewer = live ? await getCurrentUser().catch(() => null) : null;

  let notifications: AppNotification[] | null = null;
  if (!live || viewer) {
    try {
      notifications = await listNotifications(50);
    } catch (error) {
      console.error("Failed to load notifications", error);
    }
  }
  const unread = notifications?.filter((notification) => notification.readAt === null).length ?? 0;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <MartletNav />
      <main className="mx-auto max-w-3xl px-4 py-7 sm:px-8 sm:py-12">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Notifications</h1>
          {unread > 0 && (
            <form action={markAllRead}>
              <button
                type="submit"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-line-strong bg-surface px-4 text-sm font-bold text-ink-soft hover:border-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
              >
                <CheckCheck aria-hidden="true" size={15} /> Mark all read
              </button>
            </form>
          )}
        </div>

        {live && !viewer && (
          <div className="mt-5 rounded-2xl border border-line bg-surface px-5 py-8 text-center">
            <LogIn aria-hidden="true" className="mx-auto mb-3 text-brand-ink" />
            <p className="font-semibold text-ink-soft">Sign in to see your notifications</p>
            <Link
              href="/login?next=%2Fnotifications"
              className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand px-4 text-sm font-bold text-on-brand hover:bg-brand-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
            >
              Sign in
            </Link>
          </div>
        )}

        {!live && (
          <p className="mt-4 rounded-xl border border-warn-line bg-warn-soft px-4 py-3 text-sm text-warn-ink">
            <strong>Preview:</strong> notifications need Supabase. See <code>docs/SUPABASE_SETUP.md</code>.
          </p>
        )}

        {notifications !== null && (
          <>
            {notifications.length === 0 ? (
              <p className="mt-5 rounded-2xl border border-dashed border-line-strong bg-surface px-5 py-10 text-center text-ink-muted">
                Nothing yet. Course-matched meetups, start-soon reminders and likes on your trends will land here.
              </p>
            ) : (
              <ul className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-surface">
                {notifications.map((notification) => (
                  <NotificationRow key={notification.id} notification={notification} />
                ))}
              </ul>
            )}
          </>
        )}

        {live && viewer && notifications === null && (
          <p role="alert" className="mt-5 rounded-2xl border border-line bg-surface px-5 py-8 text-center text-ink-muted">
            Couldn’t load notifications. Refresh to try again.
          </p>
        )}
      </main>
    </div>
  );
}
