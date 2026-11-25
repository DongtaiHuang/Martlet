"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { MAX_BUY, MarketError, proposeMarket, resolveMarket, reviewMarket, tradeMarket } from "@/lib/markets";
import { AuthRequiredError } from "@/lib/supabase/auth";
import { formatShares } from "@/components/markets/format";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type MarketFormState = { error?: string; ok?: string; fields?: Record<string, string> };

const str = (v: FormDataEntryValue | null) => (typeof v === "string" ? v : "");
function friendly(error: unknown): string {
  if (error instanceof MarketError) return error.message;
  if (error instanceof AuthRequiredError) return "Sign in to do that.";
  console.error("Market action failed", error);
  return "Something went wrong. Try again.";
}
const shares = (n: number) => formatShares(Math.abs(n));

export async function tradeAction(marketId: string, _: MarketFormState, form: FormData): Promise<MarketFormState> {
  const side = str(form.get("side"));
  const action = str(form.get("action"));
  const amount = Number(str(form.get("amount")));
  if (side !== "yes" && side !== "no") return { error: "Pick Yes or No." };
  if (action !== "buy" && action !== "sell") return { error: "Pick buy or sell." };
  if (action === "buy" && !(Number.isInteger(amount) && amount >= 1 && amount <= MAX_BUY)) return { error: `Spend between 1 and ${MAX_BUY} whole points.` };
  if (action === "sell" && !(amount > 0)) return { error: "Enter how many shares to sell." };
  try {
    const r = await tradeMarket(marketId, side, action, amount);
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/markets");
    const label = side === "yes" ? "Yes" : "No";
    return {
      ok: action === "buy"
        ? `Bought ${shares(r.shares)} ${label} shares for ${r.points} points. Now ${Math.round(r.probability * 100)}% yes.`
        : `Sold ${shares(r.shares)} ${label} shares for ${-r.points} points. Now ${Math.round(r.probability * 100)}% yes.`,
    };
  } catch (error) {
    return { error: friendly(error) };
  }
}

export async function proposeAction(_: MarketFormState, form: FormData): Promise<MarketFormState> {
  const question = str(form.get("question")).trim().replace(/\s+/g, " ");
  const details = str(form.get("details")).trim();
  const closesAt = str(form.get("closes_at"));
  const fields = { question, details, closes_local: str(form.get("closes_local")) };
  if (question.length < 10 || question.length > 140) return { error: "The question needs 10 to 140 characters.", fields };
  if (!question.endsWith("?")) return { error: "Phrase it as a yes/no question ending with “?”.", fields };
  if (details.length < 10 || details.length > 1000) return { error: "Say how it resolves in 10 to 1000 characters: the source and the exact condition.", fields };
  const closes = Date.parse(closesAt);
  if (!Number.isFinite(closes)) return { error: "Pick when trading closes.", fields };
  let id: string;
  try {
    id = await proposeMarket({ question, details, closesAt: new Date(closes).toISOString() });
  } catch (error) {
    return { error: friendly(error), fields };
  }
  revalidatePath("/markets");
  redirect(`/markets/${id}?proposed=1`);
}

export async function reviewAction(form: FormData) {
  const id = str(form.get("id"));
  const approve = str(form.get("decision")) === "approve";
  if (!UUID.test(id)) return;
  try { await reviewMarket(id, approve); } catch (error) { console.warn("review failed", friendly(error)); }
  revalidatePath("/markets/review");
  revalidatePath("/markets");
}

export async function resolveAction(marketId: string, _: MarketFormState, form: FormData): Promise<MarketFormState> {
  const outcome = str(form.get("outcome"));
  if (outcome !== "yes" && outcome !== "no" && outcome !== "cancelled") return { error: "Pick an outcome." };
  if (str(form.get("confirm")) !== "on") return { error: "Tick the box to confirm. Settling can't be undone." };
  try {
    const paid = await resolveMarket(marketId, outcome);
    revalidatePath(`/markets/${marketId}`);
    revalidatePath("/markets");
    return { ok: `Settled. ${paid} ${paid === 1 ? "position was" : "positions were"} paid out.` };
  } catch (error) {
    return { error: friendly(error) };
  }
}
