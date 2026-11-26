import type { CSSProperties, ReactNode } from "react";
import { PixelSprite } from "@/components/pixel/PixelSprite";
import { COIN, FELT_TILE, chipSprite } from "./pixel-cards";

/** The table: dithered pixel felt inside a wooden rail (ADR 0044). */
export const FELT_CLASS = "overflow-hidden rounded-xl border-8 border-[#4a2f1d] p-4 text-white shadow-[inset_0_0_0_2px_#2a1d1a,0_10px_24px_rgb(0_0_0/0.25)] sm:p-6";
export const FELT_STYLE: CSSProperties = { backgroundColor: "#1f6b46", backgroundImage: FELT_TILE, backgroundSize: "12px 12px", imageRendering: "pixelated" };

export function PixelCoin({ className = "size-4" }: { className?: string }) {
  return <PixelSprite sprite={COIN} className={className} />;
}

/** A bet chip: the pixel chip with its value on top. Wraps the radio input for that value. */
export function PixelChip({ value, selected, disabled, children }: { value: number; selected: boolean; disabled: boolean; children: ReactNode }) {
  return (
    <label className={`relative inline-grid size-12 cursor-pointer place-items-center rounded-full text-sm font-extrabold text-white transition-transform [text-shadow:1px_1px_0_#2a1d1a,-1px_-1px_0_#2a1d1a,1px_-1px_0_#2a1d1a,-1px_1px_0_#2a1d1a] has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-white ${selected ? "-translate-y-1 ring-2 ring-amber-300 ring-offset-2 ring-offset-[#1f6b46]" : "hover:-translate-y-0.5"} ${disabled ? "opacity-40" : ""}`}>
      <PixelSprite sprite={chipSprite(value)} className="absolute inset-0 size-full" />
      <span className="relative">{children}</span>
    </label>
  );
}
