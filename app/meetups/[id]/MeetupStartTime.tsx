"use client";

import { useSyncExternalStore } from "react";

const subscribe = () => () => {};
const browserTimeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone;
const serverTimeZone = () => "America/Toronto";

export function MeetupStartTime({ startsAt }: { startsAt: string }) {
  const timeZone = useSyncExternalStore(subscribe, browserTimeZone, serverTimeZone);
  const formatted = new Intl.DateTimeFormat("en-CA", {
    dateStyle: "full",
    timeStyle: "short",
    timeZone,
  }).format(new Date(startsAt));

  return <time dateTime={startsAt}>{formatted}</time>;
}
