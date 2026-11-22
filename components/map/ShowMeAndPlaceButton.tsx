"use client";

import { useState } from "react";
import { LocateFixed, LoaderCircle } from "lucide-react";
import { distanceMetres, formatDistance, requestPositionOnce, type LocateError, type Position } from "./locate-me";

type State =
  | { kind: "idle" }
  | { kind: "locating" }
  | { kind: "shown"; metres: number }
  | { kind: "error"; reason: LocateError };

const ERRORS: Record<LocateError, string> = {
  unsupported: "This browser can’t share your location here. Location needs a secure (https) page.",
  denied: "Location permission is off. Allow it for this site in your browser settings, then try again.",
  unavailable: "Couldn’t find your location. Check that location services are on, then try again.",
};

/**
 * Opt-in button that frames the user and a place on the same map (issue #34, ADR 0008).
 * The map draws the "you" dot and fits both points in `onLocated`; the position never leaves the browser.
 */
export function ShowMeAndPlaceButton({ place, placeName, onLocated }: {
  place: Position;
  placeName: string;
  onLocated: (position: Position) => void;
}) {
  const [state, setState] = useState<State>({ kind: "idle" });

  async function locate() {
    setState({ kind: "locating" });
    try {
      const position = await requestPositionOnce();
      onLocated(position);
      setState({ kind: "shown", metres: distanceMetres(position, place) });
    } catch (reason) {
      setState({ kind: "error", reason: reason as LocateError });
    }
  }

  const locating = state.kind === "locating";

  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
      <button
        type="button" onClick={locate} disabled={locating}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-line bg-surface px-3.5 text-sm font-semibold text-ink-soft hover:border-brand-line hover:text-brand-ink-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus disabled:opacity-60"
      >
        {locating ? <LoaderCircle aria-hidden="true" size={17} className="motion-safe:animate-spin" /> : <LocateFixed aria-hidden="true" size={17} />}
        {state.kind === "shown" ? "Update my location" : `Show me and ${placeName}`}
      </button>
      <p role="status" className="min-w-0 text-sm text-ink-muted">
        {state.kind === "locating" && "Finding your location…"}
        {state.kind === "shown" && `You’re ${formatDistance(state.metres)} from ${placeName} in a straight line.`}
        {state.kind === "error" && ERRORS[state.reason]}
      </p>
    </div>
  );
}
