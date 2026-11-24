// Customisable feed dashboard (issue #46, ADR 0031). Pure functions, safe on server and client.
// The layout lives in a cookie so the server renders the student's order from the first paint.

export const WIDGETS = ["trends", "daily", "news", "flight"] as const;
export type WidgetId = (typeof WIDGETS)[number];

export const WIDGET_INFO: Record<WidgetId, { label: string; description: string }> = {
  trends: { label: "Trending on campus", description: "Most-liked coffee, study spots, recipes and songs" },
  daily: { label: "Today at McGill", description: "A daily fact and tip" },
  news: { label: "McGill News", description: "Latest headlines" },
  flight: { label: "Martlet Flight", description: "The mini-game and its leaderboard" },
};

export interface DashboardLayout {
  /** Every widget, in display order. */
  order: WidgetId[];
  hidden: WidgetId[];
  /** The photo carousel at the top of the feed. */
  hero: boolean;
}

export const DASHBOARD_COOKIE = "martlet.dashboard";
export const DEFAULT_LAYOUT: DashboardLayout = { order: [...WIDGETS], hidden: [], hero: true };

const isWidget = (v: string): v is WidgetId => (WIDGETS as readonly string[]).includes(v);

/** Cookie format: `h1.trends.-daily.news.flight` (h1/h0 = carousel shown, "-" = hidden widget).
 *  Only letters, digits, "." and "-", so it's a valid cookie value without encoding. */
export function serializeLayout(layout: DashboardLayout): string {
  return [layout.hero ? "h1" : "h0", ...layout.order.map((id) => (layout.hidden.includes(id) ? `-${id}` : id))].join(".");
}

/** Reads an untrusted cookie value. Unknown or repeated ids are dropped, and widgets missing from
 *  it (e.g. added in a later release) are appended in their default position, shown. */
export function parseLayout(raw: string | undefined | null): DashboardLayout {
  if (!raw || raw.length > 200) return { ...DEFAULT_LAYOUT, order: [...DEFAULT_LAYOUT.order] };
  const [first, ...rest] = raw.split(".");
  const hero = first !== "h0";
  const tokens = first === "h0" || first === "h1" ? rest : [first, ...rest];
  const order: WidgetId[] = [], hidden: WidgetId[] = [];
  for (const token of tokens) {
    const off = token.startsWith("-"), id = off ? token.slice(1) : token;
    if (!isWidget(id) || order.includes(id)) continue;
    order.push(id);
    if (off) hidden.push(id);
  }
  for (const id of WIDGETS) if (!order.includes(id)) order.push(id);
  return { order, hidden, hero };
}

/** Moves a widget to position `to` (clamped). */
export function moveWidget(layout: DashboardLayout, id: WidgetId, to: number): DashboardLayout {
  const order = layout.order.filter((w) => w !== id);
  order.splice(Math.max(0, Math.min(order.length, to)), 0, id);
  return { ...layout, order };
}

export function toggleWidget(layout: DashboardLayout, id: WidgetId): DashboardLayout {
  const hidden = layout.hidden.includes(id) ? layout.hidden.filter((w) => w !== id) : [...layout.hidden, id];
  return { ...layout, hidden };
}

export const visibleWidgets = (layout: DashboardLayout) => layout.order.filter((id) => !layout.hidden.includes(id));
