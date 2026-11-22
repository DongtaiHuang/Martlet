const MINUTE_MS = 60_000;

export function formatLocalMinute(timestamp: number): string {
  const date = new Date(timestamp);
  return new Date(timestamp - date.getTimezoneOffset() * MINUTE_MS).toISOString().slice(0, 16);
}

/** Resolve wall time using the browser's timezone. Reject skipped times and invalid dates. */
export function localTimeToUtc(value: string): string {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return "";
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && formatLocalMinute(date.getTime()) === value
    ? date.toISOString() : "";
}

export function futureLocalTimeToUtc(value: string, now = Date.now()): string {
  const utc = localTimeToUtc(value);
  return Date.parse(utc) > now ? utc : "";
}

export function nextLocalMinute(now = Date.now()): string {
  let candidate = (Math.floor(now / MINUTE_MS) + 1) * MINUTE_MS;
  // An ambiguous wall time resolves to the earlier occurrence. Skip it if that has passed.
  while (true) {
    const local = formatLocalMinute(candidate);
    if (futureLocalTimeToUtc(local, now)) return local;
    candidate += MINUTE_MS;
  }
}