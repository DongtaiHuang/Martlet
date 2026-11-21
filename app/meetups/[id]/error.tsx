"use client";

import { MeetupRouteStatus } from "@/components/forms/MeetupRouteStatus";

export default function Error({ retry }: { retry: () => void }) {
  return <MeetupRouteStatus title="Couldn’t load this meetup" description="Try again or return to the feed." retry={retry} />;
}
