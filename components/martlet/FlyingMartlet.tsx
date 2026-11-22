"use client";

import { Bird } from "lucide-react";
import { useEffect, useState } from "react";
import { MCGILL_FACTS } from "@/lib/mcgill-facts";

function pickFact(previous?: string): string {
  const options = MCGILL_FACTS.filter((fact) => fact !== previous);
  return options[Math.floor(Math.random() * options.length)];
}

/** Decorative martlet that flies across the top of the screen carrying a random McGill fact. */
export function FlyingMartlet() {
  const [fact, setFact] = useState<string | null>(null);

  // Pick after mount: calling Math.random() during render would cause a hydration mismatch.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- client-only random value
    setFact(pickFact());
  }, []);

  if (!fact) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 bottom-8 z-40 overflow-hidden">
      <div
        className="martlet-flight flex w-max items-center gap-2"
        // Fires when the loop restarts, while the bird is off-screen, so the text never swaps in view.
        onAnimationIteration={() => setFact((current) => pickFact(current ?? undefined))}
      >
        <span className="max-w-xs rounded-xl bg-white/95 px-3 py-2 text-sm text-stone-900 shadow-lg ring-1 ring-stone-200">
          {fact}
        </span>
        <Bird className="martlet-flap text-red-800" size={36} />
      </div>
    </div>
  );
}
