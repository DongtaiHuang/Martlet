// Notifications (issues #25 + #30, ADR 0021). Rows are created only by
// security-definer RPCs; clients read their own rows and mark them read.

export type NotificationKind = "meetup_new" | "meetup_reminder" | "trend_like" | "meetup_updated" | "listing_message";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href: string;
  meetupId: string | null;
  readAt: string | null;
  createdAt: string;
}
