import { PixelSprite } from "@/components/pixel/PixelSprite";
import { cardInfo } from "@/lib/blackjack-engine";
import { CARD_BACK, cardFace } from "./pixel-cards";

// Pixel cards are 20 x 30 art pixels (ADR 0044), so boxes keep that 2:3 shape.
const SIZES = {
  md: { box: "h-24 w-16 sm:h-30 sm:w-20" },
  sm: { box: "h-[66px] w-11 sm:h-21 sm:w-14" },
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
        <div className="bj-face absolute inset-0 drop-shadow-[2px_2px_0_rgb(0_0_0/0.35)]">
          {c && <PixelSprite sprite={cardFace(c.rank, c.suit, c.red)} className="size-full" />}
        </div>
        <div className="bj-face bj-back absolute inset-0 drop-shadow-[2px_2px_0_rgb(0_0_0/0.35)]">
          <PixelSprite sprite={CARD_BACK} className="size-full" />
        </div>
      </div>
    </div>
  );
}
