"use server";

import { revalidatePath } from "next/cache";
import { CoinError, getCoinSnapshot, tradeCoin, COIN_RANGES, MAX_COIN_BUY, type CoinRange, type CoinSnapshot } from "@/lib/martlet-coin";
import { formatCoins } from "@/lib/martlet-coin-types";
import { AuthRequiredError } from "@/lib/supabase/auth";

export type CoinResponse = { snapshot?: CoinSnapshot; ok?: string; error?: string };

function friendly(error: unknown): string {
  if (error instanceof CoinError) return error.message;
  if (error instanceof AuthRequiredError) return "Sign in to trade.";
  console.error("Coin action failed", error);
  return "Something went wrong. Try again.";
}

export async function coinSnapshotAction(range: string): Promise<CoinResponse> {
  const r = (COIN_RANGES as readonly string[]).includes(range) ? (range as CoinRange) : "1d";
  const snapshot = await getCoinSnapshot(r);
  return snapshot ? { snapshot } : { error: "Martlet Coin isn't available right now." };
}

export async function tradeCoinAction(side: string, amount: number, range: string): Promise<CoinResponse> {
  if (side !== "buy" && side !== "sell") return { error: "Pick buy or sell." };
  if (side === "buy" && !(Number.isInteger(amount) && amount >= 1 && amount <= MAX_COIN_BUY)) return { error: `Buy with 1 to ${MAX_COIN_BUY} whole points.` };
  if (side === "sell" && !(amount > 0)) return { error: "Enter how many coins to sell." };
  try {
    const t = await tradeCoin(side, amount);
    revalidatePath("/coin");
    const { snapshot } = await coinSnapshotAction(range);
    return {
      snapshot,
      ok: side === "buy"
        ? `Bought ${formatCoins(Number(t.coins))} MLT for ${t.points} points at ${Number(t.fill).toFixed(4)}.`
        : `Sold ${formatCoins(Number(t.coins))} MLT for ${t.points} points at ${Number(t.fill).toFixed(4)}.`,
    };
  } catch (error) {
    return { error: friendly(error) };
  }
}
