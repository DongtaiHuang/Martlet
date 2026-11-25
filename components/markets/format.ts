const TIME_ZONE = "America/Montreal";

/** "Closes in 3 days", "Closes in 5 hours", "Closed". */
export function closesLabel(closesAt: string, now: number): string {
  const ms = Date.parse(closesAt) - now;
  if (!(ms > 0)) return "Trading closed";
  const hours = ms / 3_600_000;
  if (hours < 1) return "Closes in under an hour";
  if (hours < 48) return `Closes in ${Math.round(hours)} hours`;
  return `Closes in ${Math.round(hours / 24)} days`;
}

export const formatWhen = (iso: string) => new Intl.DateTimeFormat("en-CA", {
  timeZone: TIME_ZONE, weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
}).format(Date.parse(iso));

/** Shares to 1 or 2 decimals, rounded down (payouts are rounded down too). */
export const formatShares = (n: number) => (Math.abs(n) >= 10 ? (Math.floor(n * 10) / 10).toFixed(1) : (Math.floor(n * 100) / 100).toFixed(2));

