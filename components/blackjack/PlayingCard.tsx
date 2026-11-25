import { cardInfo } from "@/lib/blackjack-engine";

const SIZES = {
  md: { box: "h-24 w-16 sm:h-28 sm:w-20", corner: "text-sm sm:text-base", pip: "text-3xl sm:text-4xl" },
  sm: { box: "h-16 w-11 sm:h-20 sm:w-14", corner: "text-[11px] sm:text-xs", pip: "text-xl sm:text-2xl" },
} as const;

/**
 * A playing card that slides in when it first appears and flips when `down` turns false
 * (keep its React key stable for the flip). Animations live in globals.css (.bj-*), and are off
 * with reduced motion.
 */
export function PlayingCard({ card, down = false, from = "dealer", size = "md" }: {
  card: number | null; down?: boolean; from?: "dealer" | "player"; size?: keyof typeof SIZES;
}) {
  const c = card === null ? null : cardInfo(card);
  const faceDown = down || !c;
  const s = SIZES[size];
  return (
    <div
      role="img" aria-label={faceDown ? "Face-down card" : c.name}
      className={`bj-card bj-deal shrink-0 ${s.box}`}
      style={{ "--bj-from-x": from === "dealer" ? "140px" : "120px" } as React.CSSProperties}
    >
      <div className="bj-card-inner relative size-full" data-down={faceDown}>
        <div className={`bj-face absolute inset-0 rounded-lg border border-neutral-300 bg-white shadow-md ${c?.red ? "text-red-700" : "text-neutral-900"}`}>
          {c && (
            <>
              <span aria-hidden="true" className={`absolute top-1 left-1.5 leading-none font-bold ${s.corner}`}>{c.rank}<br />{c.suit}</span>
              <span aria-hidden="true" className={`absolute inset-0 flex items-center justify-center ${s.pip}`}>{c.suit}</span>
              <span aria-hidden="true" className={`absolute right-1.5 bottom-1 rotate-180 leading-none font-bold ${s.corner}`}>{c.rank}<br />{c.suit}</span>
            </>
          )}
        </div>
        <div className="bj-face bj-back absolute inset-0 rounded-lg border-2 border-white/80 bg-brand bg-[repeating-linear-gradient(45deg,transparent_0_6px,rgb(255_255_255/0.18)_6px_8px)] shadow-md" />
      </div>
    </div>
  );
}
