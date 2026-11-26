import type { CSSProperties, ReactNode } from "react";
import { PixelSprite } from "@/components/pixel/PixelSprite";
import { COIN, FELT_TILE, chipSprite } from "./pixel-cards";
import { feltTile, roomFor, tileBackground, WALL_SIZE } from "./rooms";

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

/** Felt style for a table: its room's felt and rail, or the plain green table. */
export function feltStyleFor(tableId: string | null): CSSProperties {
  const room = tableId ? roomFor(tableId) : null;
  if (!room) return FELT_STYLE;
  return { ...FELT_STYLE, ...tileBackground(feltTile(room.felt), 3), backgroundColor: room.felt[0], borderColor: room.rail };
}

/** The room's pixel wall across the top of the table, with its name (ADR 0044). */
export function RoomWall({ tableId }: { tableId: string }) {
  const room = roomFor(tableId);
  if (!room) return null;
  return (
    <div className={`relative -mx-4 -mt-4 mb-4 sm:-mx-6 sm:-mt-6 ${tableId === "bronfman" ? "bj-ticker" : ""}`}
      style={{ ...tileBackground(room.wall, 3), height: WALL_SIZE.h * 3 }}>
      <p className="absolute bottom-1.5 left-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] font-bold tracking-wide text-white">{room.title}</p>
    </div>
  );
}
