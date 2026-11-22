import Link from "next/link";
import { Bell } from "lucide-react";
import { countUnreadNotifications, materializeReminders } from "@/lib/notifications";
import { getDataMode } from "@/lib/supabase/env";

/**
 * Server component: the bell in the nav. Reminders materialize on load
 * (idempotent RPC, ADR 0021); any failure leaves the bell at zero rather
 * than breaking the page. Hidden in preview mode.
 */
export async function NotificationBell() {
  if (getDataMode() !== "live") return null;

  await materializeReminders().catch(() => null);
  const unread = await countUnreadNotifications().catch(() => 0);

  return (
    <Link
      href="/notifications"
      aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
      className="relative inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl border border-line-strong bg-surface text-ink-soft hover:border-brand hover:text-brand-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <Bell aria-hidden="true" size={18} />
      {unread > 0 && (
        <span
          aria-hidden="true"
          className="absolute top-0.5 right-0.5 grid min-h-5 min-w-5 place-items-center rounded-full bg-brand px-1 text-[11px] font-bold text-on-brand tabular-nums"
        >
          {unread > 9 ? "9+" : unread}
        </span>
      )}
    </Link>
  );
}
